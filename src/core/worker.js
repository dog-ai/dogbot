/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js');
var kue = require('kue-scheduler');

var REDIS_UNIX_SOCKET = __dirname + '/../../var/run/redis.sock';

function worker() {
    var database = undefined;
    var queue = undefined;
}

worker.prototype.start = function (database, enqueue, processJob) {

    if (database === undefined || database === null) {
        throw new Error('Unable to start worker: no database available');
    }
    this.database = database;

    this.queue = kue.createQueue({
        redis: {
            socket: REDIS_UNIX_SOCKET
        },
        prefix: database.name
    });

    var process = function (job, done) {
        logger.debug('Job ' + job.id + ' started' +
            (job.data.params !== undefined && job.data.params !== null ? ' with params ' + JSON.stringify(job.data.params) : ''));

        processJob(job.data.event, job.data.params).then(function () {
            done();
        }).catch(function (error) {
            done(error);
        }).finally(function () {
            logger.debug('Job ' + job.id + ' completed');
        });
    };

    this.queue.process('worker', process);

    this.queue.process('slow', 4, process);

    this.queue
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

    logger.info("Ready to process jobs");
};

worker.prototype.stop = function (callback) {
    if (this.queue !== undefined && this.queue !== null) {
        this.queue.shutdown(5000, function (error) {
            if (error) {
                console.error(error);
            }

            if (callback !== undefined) {
                callback();
            }
        });
    }
};

worker.prototype._enqueue = function (event, params, schedule) {
    var type = event === 'person:device:discover' ? 'slow' : 'worker';

    var job = instance.queue.create(type, {
        event: event,
        params: params

    });

    switch (type) {
        case 'worker':
            job.ttl(59 * 1000); // 59 seconds
            break;
        case 'slow':
            job.ttl(10 * 60 * 1000); // 10 minutes
            break;
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

var instance = new worker();

module.exports = instance;