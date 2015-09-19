/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');
//var stackTrace = require('stack-trace');
var communication = require('./utils/communication.js');
var revision = require('./utils/revision.js');
var synchronization = require('./utils/synchronization.js');
var databases = require('./databases.js')(communication);
var modules = require('./modules.js')(communication);

var dogbot = {
    secret: undefined,

    start: function (callback) {
        var self = this;

        databases.startAll(function () {

            synchronization.start(self.secret, function (error) {
                    if (error) {
                        console.error(error.message);

                        //modules.loadAll();
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
                    communication.emit('synchronization:incoming:person:employee:delete', employee);
                },
                function (callback) {
                    communication.emit('synchronization:outgoing:person:mac_address', callback);
                },
                function (callback) {
                    communication.emit('database:performance:retrieveOneByOne',
                        'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
                            if (error) {
                                console.error(error.stack);
                            } else {
                                if (row !== undefined) {
                                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                                    row.is_present = row.is_present == 1 ? true : false;

                                    callback(error, row.employee_id, 'presence', row, function (error) {
                                        if (error) {
                                            console.error(error)
                                        } else {
                                            communication.emit('database:performance:update',
                                                'UPDATE presence SET is_synced = 1 WHERE id = ?', [row.id], function (error) {
                                                    if (error) {
                                                        console.error(error.stack);
                                                    }
                                                });
                                        }
                                    });
                                }
                            }
                        });
                },
                function (performanceName, performance) {
                    communication.emit('synchronization:performance:' + performanceName, performance);
                },
                function (callback) {
                    communication.on('person:device:online', callback);
                    communication.on('person:device:offline', callback);
                },
                function (callback) {
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
