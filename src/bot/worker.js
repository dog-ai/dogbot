/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
    kue = require('kue-scheduler'),
    Promise = require('bluebird');

var WORKER_DATABASE_TYPE = 'nosql',
    WORKER_DATABASE_NAME = 'worker',
    REDIS_UNIX_SOCKET = __dirname + '/../../var/run/redis.sock';

function worker() {
}

worker.prototype.initialize = function (enqueue, dequeue, processJob) {
    return new Promise(function (resolve, reject) {

        if (!instance.databases) {
            reject(new Error("Unable to initialize worker because no database available"));
        } else {
            instance.databases.startDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
                .then(function () {
                    instance.queue = kue.createQueue({
                        redis: {
                            socket: REDIS_UNIX_SOCKET
                        },
                        prefix: WORKER_DATABASE_NAME
                    });

                    var process = function (job, done) {
                        logger.debug('Job ' + job.id + ' started' +
                            (job.data.params !== undefined && job.data.params !== null ? ' with params ' + JSON.stringify(job.data.params) : ''));

                        processJob(job.data.event, job.data.params)
                            .then(function () {
                                done();
                            })
                            .catch(function (error) {
                                done(error);
                            })
                            .finally(function () {
                                logger.debug('Job ' + job.id + ' completed');
                            });
                    };

                    instance.queue.process('worker', process);

                    instance.queue.process('slow', 4, process);

                    instance.queue.process('fast', process);

                    instance.queue
                        .on('job enqueue', function (id, type) {
                            kue.Job.get(id, function (error, job) {
                                logger.debug('Queued ' + job.data.event + ' with job id ' + id +
                                    (job.data.params !== undefined && job.data.params !== null ? ' and params ' + JSON.stringify(job.data.params) : ''));
                            });
                        }).on('job complete', function (id, result) {
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
                    }).on('job failed', function (id) {
                        kue.Job.get(id, function (error, job) {
                            if (error) {

                            } else {
                                logger.error('Job ' + id + ' failed: ' + job.error());
                            }
                        });
                    }).on('job failed attempt', function (id, attempts) {
                        logger.debug('Job ' + id + ' failed ' + attempts + ' times');
                    }).on('schedule success', function (job) {
                    }).on('schedule error', function (error) {
                        logger.error('schedule error: ' + error);
                    }).on('already scheduled', function (job) {
                    }).on('scheduler unknown job expiry key', function (message) {
                    }).on('error', function (error) {
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
                }

                instance.databases.stopDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
                    .then(resolve)
                    .catch(reject);
            });
        } else {
            resolve();
        }
    });
};

worker.prototype._enqueue = function (event, params, schedule) {
    var type;
    switch (event) {
        case 'person:device:discover':
            type = 'slow';
            break;
        case 'watchdog:heartbeat':
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

    if (instance.queue) {
        instance.queue.remove({unique: event, data: {unique: event}}, function (error, response) {
            if (error) {
                logger.error(errro.stack);
            }
        });
    }
};

var instance = new worker();

module.exports = function (databases) {
    instance.databases = databases;

    return instance;
};