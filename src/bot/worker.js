/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
  _ = require('lodash'),
  Promise = require('bluebird');

var kue = require('kue-scheduler');

var WORKER_DATABASE_TYPE = 'nosql',
  WORKER_DATABASE_NAME = 'worker';

var JobTypeEnum = Object.freeze({
  FAST: 'FAST',
  NORMAL: 'NORMAL',
  SLOW: 'SLOW'
});

var JobTypeTtlEnum = Object.freeze({
  FAST: 10000, // 10 sec,
  NORMAL: 60000, // 1 min
  SLOW: 240000 // 4 min
});

function worker() {
}

worker.prototype.initialize = function (enqueue, dequeue, emit) {
  return new Promise(function (resolve, reject) {

    if (!instance.databases) {
      reject(new Error("Unable to initialize worker because no database available"));
    } else {
      instance.databases.startDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
        .then(function (result) {

          instance.queue = kue.createQueue(result);

          var process = function (job, callback) {
            var id = job.id;
            var event = job.data.event;
            var params = job.data.params;
            var callbacks = job.data.callbacks || {};

            logger.debug('Job ' + id + ' started' + (params ? ' with params ' + JSON.stringify(params) : ''));

            emit(event, params)
              .then(function (result) {
                callback(null, result);

                if (callbacks.resolve) {
                  emit(callbacks.resolve, result);
                }
              })
              .catch(function (error) {
                callback(error);

                if (callbacks.reject) {
                  emit(callbacks.reject, error);
                }
              });
          };

          instance.queue.process(JobTypeEnum.FAST, process);
          instance.queue.process(JobTypeEnum.NORMAL, process);
          instance.queue.process(JobTypeEnum.SLOW, 2, process);

          instance.queue.on('job enqueue', function (id, type) {
            kue.Job.get(id, function (error, job) {
              logger.debug('Job ' + id + ' queued with ' + job.data.event +
                (job.data.params ? ' and params ' + JSON.stringify(job.data.params) : ''));
            });
          });
          instance.queue.on('job complete', function (id, result) {
            logger.debug('Job ' + id + ' completed' + (result ? ' with result ' + JSON.stringify(result) : ''));

            kue.Job.get(id, function (error, job) {
              if (!error) {
                job.remove();
              }
            });
          });
          instance.queue.on('job failed', function (id, error) {
            logger.debug('Job ' + id + ' failed because of ' + error.message);

            logger.error(error.message, error);
          });
          instance.queue.on('job failed attempt', function (id, attempts) {
            logger.debug('Job ' + id + ' failed ' + attempts + ' times');
          });
          instance.queue.on('schedule success', function (job) {
            instance._schedules[job.data.event] = _.pick(job.data, ['expiryKey', 'dataKey']);
          });
          instance.queue.on('schedule error', function (error) {
          });
          instance.queue.on('already scheduled', function (job) {
          });
          instance.queue.on('scheduler unknown job expiry key', function (message) {
          });
          instance.queue.on('error', function (error) {
          });

          enqueue(instance._enqueue);
          dequeue(instance._dequeue);

        })
        .then(resolve).catch(reject);
    }
  });
};

worker.prototype.terminate = function () {
  return new Promise(function (resolve, reject) {
    if (instance.queue) {
      try {
        instance.queue.shutdown(100, function (error) {
          if (error) {
            //reject(error);
            resolve()
          } else {
            resolve();
          }
        });
      } catch (ignored) {}
    } else {
      resolve();
    }
  })
    .then(function () {
      return instance.databases.stopDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME);
    });
};

worker.prototype._enqueue = function (event, params, schedule, callbacks) {
  var type;
  switch (event) {
    case 'social:linkedin:company:import':
    case 'person:device:discover':
      type = JobTypeEnum.SLOW;
      break;
    case 'bot:heartbeat':
      type = JobTypeEnum.FAST;
      break;
    default:
      type = JobTypeEnum.NORMAL;
  }

  var job = instance.queue.create(type, {event: event, params: params, callbacks: callbacks});
  job.ttl(JobTypeTtlEnum[type]);

  if (schedule) {
    instance.queue.every(schedule, job);
  } else {
    try {
      job.save(function (error) {
        if (error) {
          throw error;
        }
      });
    } catch (ignored) {}
  }
};

worker.prototype._dequeue = function (event) {

  if (instance.queue && instance._schedules[event]) {
    instance.queue.remove(instance._schedules[event], function (error) {
      if (error) {
        //throw error;
      } else {
        delete instance._schedules[event];
      }
    });
  }
};

worker.prototype.healthCheck = function () {
  return new Promise.resolve();
};

var instance = new worker();

module.exports = function (databases) {
  instance.databases = databases;
  instance._schedules = {};

  return instance;
};