/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash'),
    Promise = require('bluebird');

var logger = require('../utils/logger.js'),
    communication = require('../utils/communication.js'),
    revision = require('../utils/revision.js');

var modules = require('../modules')(communication);
var databases = require('../databases')(communication);

var apps = require('./apps')(communication, modules, databases),
    synchronization = require('./synchronization.js'),
    worker = require('./worker.js')(databases);

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

    reload: function (callback) {
        var self = this;

        revision.hasRevisionChanged(function (error, changed, revision) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (changed) {
                    logger.info('Detected new code revision: ' + revision);
                }
            }

            self.stop(callback);
        });
    },

    error: function (error, callback) {
        logger.error(error.stack === undefined ? error : error.stack, callback);
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
                communication.on('synchronization:outgoing', callback);
                communication.emit('worker:job:enqueue', 'synchronization:outgoing', null, '10 minutes');
            },
            bot._configureApps,
            function (callback) {
                communication.on('synchronization:incoming:setup', callback);
            },
            function (callback) {
                communication.on('synchronization:outgoing:setup', callback);
            },
            function (event, callback) {
                communication.emit(event, callback);
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
    }
};

module.exports = function (secret) {
    bot.secret = secret;
    return bot;
};

