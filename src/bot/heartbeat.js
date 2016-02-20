var logger = require('../utils/logger.js'),
    Promise = require('bluebird');

var SYSTEMD_KEEP_ALIVE_PING = 'WATCHDOG=1';

function heartbeat() {

}

heartbeat.prototype.initialize = function (interval) {
    return new Promise(function (resolve, reject) {
        if (!interval > 0) {
            reject(new Error('invalid interval'));
        }

        interval = interval / 2;

        instance.communication.on('bot:heartbeat', instance._healthCheck);
        instance.communication.emit('worker:job:enqueue', 'bot:heartbeat', null, interval + ' seconds');

        instance._initialized = true;

        resolve(interval);
    });
};

heartbeat.prototype.terminate = function () {
    return new Promise(function (resolve, reject) {
        if (!instance._initialized) {
            reject('heartbeat not initialized');
        }

        instance.communication.emit('worker:job:dequeue', 'bot:heartbeat');

        resolve();
    });
};

heartbeat.prototype._healthCheck = function (params, callback) {

    instance._sendHeartbeat()
        .then(function () {
            logger.debug('heartbeat');
        })
        .finally(callback);
};

heartbeat.prototype._sendHeartbeat = function () {
    if (process.platform !== 'linux') {
        return Promise.resolve();
    } else {
        return this._execSystemdNotify(SYSTEMD_KEEP_ALIVE_PING);
    }
};

heartbeat.prototype._execSystemdNotify = function (notification) {
    return new Promise(function (resolve, reject) {
        var timeout, spawn = require('child_process').spawn,
            process = spawn('systemd-notify', [notification]);

        timeout = setTimeout(function () {
            process.kill();
            reject(new Error("Child process hanged"));
        }, 1000);

        process.on('error', function (error) {
            clearTimeout(timeout);
            reject(error);
        });

        process.on('close', function () {
            clearTimeout(timeout);
            resolve();
        });
    })
};

var instance = new heartbeat();

module.exports = function (communication) {
    instance.communication = communication;

    return instance;
};