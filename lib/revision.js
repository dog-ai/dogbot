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
        self.loadRevision(function(error, revision) {
            callback(error, self.current !== revision, revision);
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
        } catch (error) {
            callback(error, revision);
        }
    }
};

revision.loadRevision(function(error, _revision) {
    if (error !== undefined) {
        console.error(error);
    } else {
        console.log("Code revision: " + _revision);
        revision.current = _revision;
    }
});

module.exports = revision;
