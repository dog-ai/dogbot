/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash'),
    Promise = require('bluebird');

var logger = require('../utils/logger.js'),
    communication = require('../utils/communication.js');

var modules = require('../modules')(communication);
var databases = require('../databases')(communication);

var apps = require('./apps')(communication, modules, databases),
    synchronization = require('./synchronization.js'),
    worker = require('./worker.js')(databases),
    heartbeat = require('./heartbeat.js')(communication),
    autoupdate = require('./autoupdate.js')(communication);

var bot = {
    start: function (callback) {
        logger.info("Starting dogbot");

        this._configureWorker()
            .then(this._configureSynchronization)
            .then(this._configureApps)
            .catch(logger.error)
            .finally(callback);
    },

    stop: function (callback) {
        apps.disableAllApps()
            .then(synchronization.terminate)
            .then(worker.terminate)
            .then(function () {
                logger.info('Stopped dogbot');
            })
            .catch(logger.error)
            .finally(callback);
    },

    error: function (error, callback) {
        logger.error(error.stack === undefined ? error : error.stack, callback);
    },

    heartbeat: function (interval, heartbeatFn, callback) {
        heartbeat.initialize(interval, heartbeatFn, function () {
                return Promise.all([
                    apps.healthCheck(),
                    synchronization.healthCheck(),
                    worker.healthCheck()
                ])
            })
            .then(function (interval) {
                logger.info('Sending a hearbeat every ' + interval + ' seconds');
            })
            .finally(callback);
    },

    autoupdate: function (branch, updateFn) {
        autoupdate.initialize(branch, updateFn);
    },

    _configureWorker: function () {
        return worker.initialize(
            function (callback) {
                communication.on('worker:job:enqueue', callback);
            },
            function (callback) {
                communication.on('worker:job:dequeue', callback);
            },
            function (event, params) {
                return communication.emitAsync(event, params);
            });
    },

    _configureSynchronization: function () {
        return synchronization.initialize(
            bot.secret,
            function (callback) {
                // start an outgoing synchronization job every 10 minutes
                communication.on('synchronization:outgoing:periodic', callback);
                communication.emit('worker:job:enqueue', 'synchronization:outgoing:periodic', null, '10 minutes');
            },
            bot._configureApps,
            function (callback) {
                // register incoming synchronization callbacks
                communication.on('synchronization:incoming:register:setup', callback);
            },
            function (callback) {
                // register outgoing periodic synchronization callbacks
                communication.on('synchronization:outgoing:periodic:register', callback);
            },
            function (callback) {
                // register outgoing quickshot synchronization callbacks
                communication.on('synchronization:outgoing:quickshot:register', function (registerParams, registerCallback) {
                    if (registerParams && registerParams.registerEvents) {
                        _.forEach(registerParams.registerEvents, function (registerEvent) {
                            communication.on(registerEvent, function (outgoingParams, outgoingCallback) {
                                callback(registerParams, outgoingParams, outgoingCallback);
                            });
                        });
                    }

                    registerCallback();
                });
            },
            function (event, params, callback) {
                communication.emit(event, params, callback);
            }
        ).spread(function (dogId, apps) {
            logger.info('Authenticated as ' + dogId);

            return apps;
        })
    },

    _configureApps: function (_apps) {
        return Promise.all(
            _.map(_apps, function (appConfig, appName) {
                return appConfig.is_enabled ? apps.enableApp(appName, appConfig) : apps.disableApp(appName);
            }));
    },
};

module.exports = function (secret) {
    bot.secret = secret;
    return bot;
};

