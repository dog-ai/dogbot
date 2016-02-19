/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var fs = require('fs');

var REDIS_UNIX_SOCKET = __dirname + '/../../../var/run/redis.sock';

function nosql() {
    this.redis = undefined;
}

nosql.prototype.type = 'nosql';

nosql.prototype._open = function () {
    var self = this;

    return new Promise(function (resolve, reject) {

        if (self.redis === undefined || self.redis === null) {

            try {
                var pid = parseInt(execSync('pgrep redis-server')) || undefined;
                if (pid !== undefined) {
                    execSync('kill -9 ' + pid);
                    fs.unlinkSync(REDIS_UNIX_SOCKET);
                }
            } catch (error) {
            }

            self.redis = spawn('redis-server', ['share/redis/redis.conf']);

            execSync('sleep 1');

            if (!fs.existsSync(REDIS_UNIX_SOCKET)) {
                reject(new Error('redis unix socket not available'));
            } else {
                logger.debug('Started redis child process with pid: ' + self.redis.pid);

                resolve();
            }

        } else {
            resolve();
        }
    });
};

nosql.prototype._close = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        if (self.redis !== undefined && self.redis !== null) {
            logger.debug('Stopping redis child process with pid: ' + self.redis.pid);

            self.redis.kill('SIGTERM');
        }

        resolve();
    });
};

module.exports = nosql;
