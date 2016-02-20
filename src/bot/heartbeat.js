var logger = require('../utils/logger.js'),
    Promise = require('bluebird'),
    ffi = require('ffi');

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
        .catch(function (error) {
            logger.error(error.stack)
        })
        .finally(callback);
};

heartbeat.prototype._sendHeartbeat = function () {
    if (process.platform !== 'linux') {
        return Promise.resolve();
    } else {
        //return this._execSdNotify('WATCHDOG=1');
        return Promise.resolve();
    }
};

heartbeat.prototype._execSdNotify = function (notification) {
    return new Promise(function (resolve, reject) {
        var sdDaemon = ffi.Library('libsystemd', {
            'sd_notify': ['int', ['int', 'string']]
        });

        sdDaemon.sd_notify.async(0, notification, function (error, res) {
            if (error) {
                reject(new Error(error));
            } else if (!res) {
                reject(new Error('sd_notify returned ' + res))
            } else {
                resolve();
            }
        });
    });
};

var instance = new heartbeat();

module.exports = function (communication) {
    instance.communication = communication;

    return instance;
};