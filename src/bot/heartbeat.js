var logger = require('../utils/logger.js'),
    Promise = require('bluebird');

function heartbeat() {

}

heartbeat.prototype.initialize = function (interval, heartbeatFn) {
    this._heartbeatFn = Promise.promisify(heartbeatFn);

    return new Promise(function (resolve, reject) {
        if (!interval > 0) {
            reject(new Error('invalid interval'));
        }

        instance._interval = interval / 2;

        instance.communication.on('bot:heartbeat', instance._healthCheck);
        instance.communication.emit('worker:job:enqueue', 'bot:heartbeat', null, instance._interval + ' seconds');

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

        delete instance._interval;
        delete instance._heartbeatFn;
        delete instance._initialized;

        resolve();
    });
};

heartbeat.prototype._healthCheck = function (params, callback) {
    instance._heartbeatFn()
        .catch(function (error) {
            logger.error(error.stack)
        })
        .finally(callback);
};

var instance = new heartbeat();

module.exports = function (communication) {
    instance.communication = communication;

    return instance;
};