/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var stackTrace = require('stack-trace');

var revision = require('./utils/revision.js');
var synchronization = require('./utils/synchronization.js');
var modules = require('./modules.js');

var raspbot = {

    synchronizationInterval: undefined,

    start: function (callback) {
        var self = this;

        this.configure(function (configs) {
            var that = self;

            modules.loadAll(configs);

            self.synchronizationInterval = setInterval(function () {
                that.synchronize(function (error) {
                    if (error) {
                        console.error(error.stack);
                    }
                });
            }, 1 * 60 * 1000);

            callback();

        });
    },

    stop: function (callback) {
        clearInterval(this.synchronizationInterval);

        modules.unloadAll();

        callback();
    },

    reload: function (callback) {
        var self = this;

        revision.hasRevisionChanged(function (error, changed, revision) {
            if (error) {
                console.error(error);
            } else {
                /*if (changed) {
                 console.log('Detected new code revision: ' + revision);

                 modules.findAllLoadedModulesByType('IO').forEach(function(module) {
                 module.send(null, 'Refreshing my brains with code revision ' + revision);
                 });
                 }*/
            }

            self.stop(callback);
        });
    },

    configure: function (callback) {
        if (callback !== undefined && callback !== null) {
            callback(synchronization.getConfigurations());
        }
    },

    synchronize: function (callback) {
        try {
            synchronization.synchronizeDatabases(modules);

            callback(null);
        } catch (error) {
            callback(error);
        }
    },

    error: function (error) {
        var traces = stackTrace.parse(error);

        console.error(error.stack);

        if (traces !== undefined && traces !== null) {
            traces.forEach(function (trace) {
                var filename = trace.getFileName();
                var name = filename.substring(filename.lastIndexOf("/") + 1, filename.lastIndexOf("."));
                var module = modules.findLoadedModuleByName(name);
                if (module !== undefined && module !== null) {
                    modules.unloadModule(module);
                }
            });
        }
    }
};

module.exports = raspbot;
