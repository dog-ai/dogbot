/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');
//var stackTrace = require('stack-trace');

var communication = require('./utils/communication.js'),
    revision = require('./utils/revision.js'),
    synchronization = require('./utils/synchronization.js');

var databases = require('./databases.js')(communication);
var modules = require('./modules.js')(communication);


var dogbot = {
    secret: undefined,

    start: function (callback) {
        var self = this;

        databases.startAll(function () {

            synchronization.start(self.secret, function (error, dogId) {
                    if (error) {
                        console.error(error.message);

                        //modules.loadAll();
                    } else {
                    }

                    callback();
                },
                function (type, moduleName, configuration) {
                    modules.loadModule(type, moduleName, configuration, true);
                },
                function (mac_address) {
                    communication.emit('synchronization:incoming:person:macAddress:createOrUpdate', mac_address);
                },
                function (macAddress) {
                    communication.emit('synchronization:incoming:person:macAddress:delete', macAddress);
                },
                function (device) {
                    communication.emit('synchronization:incoming:person:device:createOrUpdate', device);
                },
                function (device) {
                    communication.emit('synchronization:incoming:person:device:delete', device);
                },
                function (employee) {
                    communication.emit('synchronization:incoming:person:employee:createOrUpdate', employee);
                },
                function (employee) {
                    // broadcast incoming employee delete
                    communication.emit('synchronization:incoming:person:employee:delete', employee);
                },
                function (callback) {
                    // request mac address changes
                    communication.emit('synchronization:outgoing:person:mac_address', callback);
                },
                function (performanceName, callback) {
                    // request performance changes
                    communication.emit('synchronization:outgoing:performance:' + performanceName, callback);
                },
                function (performanceName, performance) {
                    // broadcast incoming performance
                    communication.emit('synchronization:incoming:performance:' + performanceName, performance);
                },
                function (callback) {
                    // listen for device changes
                    communication.on('person:device:online', callback);
                    communication.on('person:device:offline', callback);
                },
                function (callback) {
                    // listen for device changes
                    communication.on('person:employee:nearby', callback);
                    communication.on('person:employee:faraway', callback);
                }
            );

        });
    },

    stop: function (callback) {
        modules.unloadAll();

        synchronization.stop();

        databases.stopAll();

        callback();
    },

    reload: function (callback) {
        var self = this;

        revision.hasRevisionChanged(function (error, changed, revision) {
            if (error) {
                console.error(error.stack);
            } else {
                if (changed) {
                 console.log('Detected new code revision: ' + revision);

                    /*modules.findAllLoadedModulesByType('IO').forEach(function(module) {
                     module.send(null, 'Refreshing my brains with code revision ' + revision);
                     });*/
                }
            }

            self.stop(callback);
        });
    },

    error: function (error) {
        //var traces = stackTrace.parse(error);

        console.error(error.stack);

        /*if (traces !== undefined && traces !== null) {
            traces.forEach(function (trace) {
                var filename = trace.getFileName();
                var name = filename.substring(filename.lastIndexOf("/") + 1, filename.lastIndexOf("."));
                var module = modules.findLoadedModuleByName(name);
                if (module !== undefined && module !== null) {
                    modules.unloadModule(module);
                }
            });
         }*/
    }
};

module.exports = function (secret) {
    dogbot.secret = secret;

    return dogbot;
};
