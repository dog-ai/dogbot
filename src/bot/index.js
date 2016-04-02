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
  Sync = require('./sync'),
  worker = require('./worker.js')(databases),
  heartbeat = require('./heartbeat.js')(communication),
  autoupdate = require('./autoupdate.js')(communication);

var Bot = {
  start: function (callback) {
    var _this = this;

    logger.info("Starting dogbot");

    this._configureWorker()
      .then(function () {
        // unchain so we don't get blocked by not having an internet connection
        _this._configureDataSync()
          .then(_this._configureApps)
          .then(_this._configureTaskSync)
          .catch(logger.error)
      })
      .catch(logger.error)
      .finally(callback);
  },

  stop: function (callback) {
    apps.disableAllApps()
      .then(Sync.terminate)
      .then(worker.terminate)
      .then(function () {
        logger.info('Stopped dogbot');
      })
      .catch(logger.error)
      .finally(callback);
  },

  report: function (error, callback) {
    if (!error) {
      return;
    }

    // https://github.com/winstonjs/winston/pull/838
    var _callback = callback == undefined ? null : callback;

    logger.error(error.message, error, _callback);
  },

  heartbeat: function (interval, heartbeatFn, callback) {
    heartbeat.initialize(interval, heartbeatFn, function () {
        return Promise.all([
          apps.healthCheck(),
          Sync.healthCheck(),
          worker.healthCheck()
        ])
      })
      .then(function (interval) {
        logger.info('Sending a heartbeat every ' + interval + ' seconds');
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
      }
    );
  },

  _configureDataSync: function () {
    return Sync.initialize(Bot.secret,
      function (callback) {
        // start an outgoing periodic sync job every 10 minutes
        communication.on('sync:outgoing:periodic', callback);
        communication.emit('worker:job:enqueue', 'sync:outgoing:periodic', null, '10 minutes');
      },
      Bot._configureApps,
      function (callback) {
        // listen for incoming sync callback registrations
        communication.on('sync:incoming:register:setup', callback);
      },
      function (callback) {
        // listen for outgoing periodic sync callback registrations
        communication.on('sync:outgoing:periodic:register', callback);
      },
      function (callback) {
        // listen for outgoing quickshot sync callback registrations
        communication.on('sync:outgoing:quickshot:register', function (registerParams) {

          if (registerParams && registerParams.registerEvents) {
            _.forEach(registerParams.registerEvents, function (registerEvent) {

              // listen for outgoing quickshot events
              communication.on(registerEvent, function (outgoingParams, outgoingCallback) {

                // split quickshot event arguments
                //var outgoingCallback = arguments.length > 1 && _.isFunction(arguments[arguments.length - 1]) ? arguments[arguments.length - 1] : undefined;
                //var outgoingParams = [].slice.call(arguments, 0, outgoingCallback ? arguments.length - 1 : arguments.length);

                // sync module will take care of doing the quickshot
                callback(registerParams, outgoingParams, outgoingCallback);
              });

            });
          }
        });
      },
      function (event, params, callback) {
        // trigger incoming sync data events
        communication.emit(event, params, callback);
      }
    ).spread(function (dogId, apps) {
      logger.info('Authenticated as ' + dogId);

      return apps;
    })
  },

  _configureTaskSync: function () {
    return Sync.initializeTask(
      function (event, params, progress, resolve, reject) {
        // trigger incoming sync task events

        var now = _.now();
        var callbacks = {
          'progress': event + ':progress:' + now,
          'resolve': event + ':resolve:' + now,
          'reject': event + ':reject:' + now
        }

        function onResolve(result) {
          resolve(result);

          communication.removeListener(callbacks.progress, progress);
          communication.removeListener(callbacks.reject, onReject);
        }

        function onReject(error) {
          reject(error);

          communication.removeListener(callbacks.progress, progress);
          communication.removeListener(callbacks.resolve, onResolve);
        }

        communication.on(callbacks.progress, progress);
        communication.once(callbacks.resolve, onResolve);
        communication.once(callbacks.reject, onReject);

        communication.emit('worker:job:enqueue', event, params, null, callbacks);
      }
    )
  },

  _configureApps: function (_apps) {
    return Promise.all(
      _.map(_apps, function (appConfig, appName) {
        return appConfig.is_enabled ? apps.enableApp(appName, appConfig) : apps.disableApp(appName);
      }));
  }
};

module.exports = function (secret) {
  Bot.secret = secret;

  return Bot;
};

