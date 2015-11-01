/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js');
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;

var REDIS_UNIX_SOCKET = __dirname + '/../../var/run/redis.sock';

function nosql() {
    this.redis = undefined;
}

nosql.prototype.type = 'NOSQL';

nosql.prototype._open = function () {
    try {
        var pid = parseInt(execSync('pgrep redis-server')) || undefined;
        if (pid !== undefined) {
            execSync('kill -9 ' + pid);
        }
    } catch (error) {
    }

    if (this.redis === undefined || this.redis === null) {
        this.redis = spawn('redis-server', ['share/redis/redis.conf']);

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
