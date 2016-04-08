var logger = require('../utils/logger.js'),
    Promise = require('bluebird');

function heartbeat() {

}

heartbeat.prototype.initialize = function (interval, heartbeatFn, healthCheckFn) {
    this._heartbeatFn = Promise.promisify(heartbeatFn);
    this._healthCheckFn = healthCheckFn;

    return new Promise(function (resolve, reject) {
        if (!interval > 0) {
            reject(new Error('invalid interval'));
        }

        instance._interval = interval / 2;

        instance.communication.on('bot:heartbeat', instance._sendHeartbeat);
        instance.communication.emit('worker:job:enqueue', 'bot:heartbeat', null, {schedule: instance._interval + ' seconds'});

        instance._initialized = true;

        resolve(instance._interval);
    });
};

heartbeat.prototype.terminate = function () {
    return new Promise(function (resolve, reject) {
        if (!instance._initialized) {
            reject('heartbeat not initialized');
        }

        instance.communication.emit('worker:job:dequeue', 'bot:heartbeat');
        instance.communication.removeEventListener('bot:heartbeat', instance._sendHeartbeat);

        delete instance._interval;
        delete instance._heartbeatFn;
        delete instance._initialized;

        resolve();
    });
};

heartbeat.prototype._sendHeartbeat = function (params, callback) {
    instance._healthCheckFn()
        .then(function () {
            return instance._heartbeatFn();
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        })
};

var instance = new heartbeat();

module.exports = function (communication) {
    instance.communication = communication;

    return instance;
};