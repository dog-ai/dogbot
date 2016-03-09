/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
    _ = require('lodash'),
    kue = require('kue-scheduler'),
    Promise = require('bluebird');

var WORKER_DATABASE_TYPE = 'nosql',
    WORKER_DATABASE_NAME = 'worker';

function worker() {
}

worker.prototype.initialize = function (enqueue, dequeue, processJob) {
    return new Promise(function (resolve, reject) {

        if (!instance.databases) {
            reject(new Error("Unable to initialize worker because no database available"));
        } else {
            instance.databases.startDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
                .then(function (result) {

                    instance.queue = kue.createQueue(result);

                    var process = function (job, done) {
                        logger.debug('Job ' + job.id + ' started' +
                            (job.data.params !== undefined && job.data.params !== null ? ' with params ' + JSON.stringify(job.data.params) : ''));

                        processJob(job.data.event, job.data.params)
                            .then(function (result) {
                                done(null, result);
                            })
                            .catch(function (error) {
                                done(error);
                            });
                    };

                    instance.queue.process('worker', process);

                    instance.queue.process('slow', 2, process);

                    instance.queue.process('fast', process);

                    instance.queue
                        .on('job enqueue', function (id, type) {
                            kue.Job.get(id, function (error, job) {
                                logger.debug('Job ' + id + ' queued with ' + job.data.event +
                                    (job.data.params !== undefined && job.data.params !== null ? ' and params ' + JSON.stringify(job.data.params) : ''));
                            });
                        }).on('job complete', function (id, result) {

                        logger.debug('Job ' + id + ' completed' + (result ? ' with result ' + JSON.stringify(result) : ''));

                        kue.Job.get(id, function (error, job) {
                            if (error) {
                                return;
                            }

                            job.remove(function (error) {
                                if (error) {
                                    logger.error(error.stack);
                                }
                            });
                        });
                    }).on('job failed', function (id, error) {
                        logger.debug('Job ' + id + ' failed because of ' + error);
                    }).on('job failed attempt', function (id, attempts) {
                        logger.debug('Job ' + id + ' failed ' + attempts + ' times');
                    }).on('schedule success', function (job) {
                        instance._schedules[job.data.event] = _.pick(job.data, ['expiryKey', 'dataKey']);
                    }).on('schedule error', function (error) {
                        logger.error('schedule error: ' + error);
                    }).on('already scheduled', function (job) {
                    }).on('scheduler unknown job expiry key', function (message) {
                    }).on('error', function (error) {
                        logger.error(error.stack);
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
        if (instance.queue !== undefined && instance.queue !== null) {
            instance.queue.shutdown(5000, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    })
        .then(function () {
            return instance.databases.stopDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME);
        });
};

worker.prototype._enqueue = function (event, params, schedule) {
    var type;
    switch (event) {
        case 'person:device:discover':
            type = 'slow';
            break;
        case 'bot:heartbeat':
            type = 'fast';
            break;
        default:
            type = 'worker';
    }

    var job = instance.queue.create(type, {
        event: event,
        params: params
    });

    switch (type) {
        case 'fast':
            job.ttl(10000); // 10 seconds
            break;
        case 'slow':
            job.ttl(240000); // 4 minutes
            break;
        default:
            job.ttl(60000); // 1 minute
    }

    if (schedule !== undefined && schedule !== null) {
        instance.queue.every(schedule, job);
    } else {
        job.save(function (error) {
            if (error) {
                logger.error(error.stack);
            }
        });
    }
};

worker.prototype._dequeue = function (event) {

    if (instance.queue && instance._schedules[event]) {
        instance.queue.remove(instance._schedules[event], function (error) {
            if (error) {
                logger.error(error.stack);
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