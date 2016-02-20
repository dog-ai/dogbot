var logger = require('../utils/logger.js'),
    Promise = require('bluebird'),
    ffi = require('ffi');


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
        .catch(function (error) {
            logger.error(error.stack)
        })
        .finally(callback);
};

heartbeat.prototype._sendHeartbeat = function () {
    if (process.platform !== 'linux') {
        return Promise.resolve();
    } else {
        return this._execSdNotify(SYSTEMD_KEEP_ALIVE_PING);
    }
};

heartbeat.prototype._execSdNotify = function (notification) {
    var sdDaemon = ffi.Library('systemd/sd-daemon.h', {
        'sd_notify': ['int', ['int', 'string']]
    });

    var result = sdDaemon.sd_notify(0, notification);
    logger.info("result " + result);
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
            console.log(error.stack);
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