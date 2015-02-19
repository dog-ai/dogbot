/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var revision = {
    current: undefined,

    getRevision: function() {
        return current;
    },

    hasRevisionChanged: function(callback) {
        var self = this;
        this.loadRevision(function(exception, revision) {
            if (exception !== undefined) {
                throw exception;
            } else {
                callback(self.current === revision, revision);
            }
        });
    },

    loadRevision: function(callback) {
        try {
            require('child_process')
                .exec('git rev-parse --short HEAD', {
                        cwd: __dirname
                    },
                    function(error, stdout, stderr) {
                        if (error != null) {

                        } else {
                            var revision = stdout.slice(0, stdout.length - 1);
                            callback(undefined, revision);
                        }
                    });
        } catch (exception) {
            callback(exception, revision);
        }
    }
};

revision.loadRevision(function(exception, _revision) {
    if (exception !== undefined) {

    } else {
        revision.current = _revision;
    }
});

module.exports = revision;
