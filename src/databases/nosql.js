/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js');
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var fs = require('fs');

var REDIS_UNIX_SOCKET = __dirname + '/../../var/run/redis.sock';

function nosql() {
    this.redis = undefined;
}

nosql.prototype.type = 'NOSQL';

nosql.prototype._open = function () {
    if (this.redis === undefined || this.redis === null) {
        try {
            var pid = parseInt(execSync('pgrep redis-server')) || undefined;
            if (pid !== undefined) {
                execSync('kill -9 ' + pid);
                fs.unlinkSync(REDIS_UNIX_SOCKET);
            }
        } catch (error) {
        }

        this.redis = spawn('redis-server', ['share/redis/redis.conf']);

        execSync('sleep 1');

        if (!fs.existsSync(REDIS_UNIX_SOCKET)) {
            throw new Error('redis unix socket not available');
        }

        logger.debug('Started redis child process with pid: ' + this.redis.pid);
    }
};

nosql.prototype._close = function () {
    if (this.redis !== undefined && this.redis !== null) {
        logger.debug('Stopping redis child process with pid: ' + this.redis.pid);

        this.redis.kill('SIGTERM');
    }
};

module.exports = nosql;
