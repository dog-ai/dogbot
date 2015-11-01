/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js');
var kue = require('kue-scheduler');

function worker() {
    var queue = undefined;
}

worker.prototype.start = function (enqueue, processJob) {

    this.queue = kue.createQueue({
        prefix: 'worker'
    });

    this.queue.process('worker', function (job, done) {
        logger.debug('Job ' + job.id + ' started');

        processJob(job.data.event, done);
    });

    this.queue
        .on('job enqueue', function (id, type) {
            kue.Job.get(id, function (error, job) {
                logger.debug('Queued ' + job.data.event + ' with job id ' + id);
            });
        }).on('job complete', function (id, result) {
            logger.debug('Job ' + id + ' completed');
        }).on('job failed', function (id) {
            logger.debug('Job ' + id + ' failed');
        }).on('job failed attempt', function (id, attempts) {
            logger.debug('Job ' + id + ' failed ' + attempts + ' times');
        }).on('schedule success', function (job) {
        }).on('schedule error', function (error) {
            logger.error(error);
        }).on('already scheduled', function (job) {
        }).on('scheduler unknown job expiry key', function (message) {
            logger.error(message);
        }).on('error', function (error) {
            logger.error(error);
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
    var job = instance.queue.create('worker', {
        event: event,
        params: params

    }).removeOnComplete(true);

    if (schedule !== undefined && schedule !== null) {
        instance.queue.every(schedule, job);
    } else {
        job.save(function (error) {
            if (error) {
                logger.error(error);
            }
        });
    }
};

var instance = new worker();

module.exports = instance;