/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger'),
    path = require('path');

//var nodegit = require('nodegit');

function autoupdate() {

}

autoupdate.prototype.initialize = function (branch, updateFn) {
    this._branch = branch;
    this._updateFn = updateFn;

    return new Promise(function (resolve) {

        instance.communication.on('autoupdate:check', instance._check);
        instance.communication.emit('worker:job:enqueue', 'autoupdate:check', null, {schedule: '10 minutes'});

        instance.communication.emit('worker:job:enqueue', 'autoupdate:check');

        resolve();
    });
};

autoupdate.prototype.terminate = function () {
    return new Promise(function (resolve, reject) {

        instance.communication.emit('worker:job:dequeue', 'autoupdate:check');
        instance.communication.removeEventListener('autoupdate:check', instance._check);

        resolve();
    });
};

autoupdate.prototype._check = function (params, callback) {

    /*nodegit.Repository.open(path.resolve(__dirname, "../../.git"))
        .then(function (repository) {
            return repository.fetch("origin", {
                callbacks: {
                    credentials: function (url, userName) {
                        return nodegit.Cred.sshKeyFromAgent(userName);
                    },
                    certificateCheck: function () {
                        return 1;
                    }
                }
            }).then(function () {
                return repository.getHeadCommit()
                    .then(function (commit) {
                        logger.debug('Current commit id: ' + commit.id().tostrS());
                    })
            })
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
     });*/
};

var instance = new autoupdate();

module.exports = function (communication) {

    instance.communication = communication;

    return instance;
};