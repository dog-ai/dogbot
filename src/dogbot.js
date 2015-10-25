/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');
//var stackTrace = require('stack-trace');

var logger = require('./utils/logger.js'),
    communication = require('./utils/communication.js'),
    revision = require('./utils/revision.js'),
    synchronization = require('./utils/synchronization.js');

var databases = require('./databases.js')(communication);
var modules = require('./modules.js')(communication);


var dogbot = {
    secret: undefined,

    start: function (callback) {
        var self = this;

        logger.info("Starting dogbot");

        databases.startAll(function () {
            synchronization.start(self.secret, function (error, dogId) {
                    if (error) {
                        logger.error(error.message);

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
                function (performanceName, performanceStatsPeriod, employeeId, performanceStats) {
                    // broadcast incoming performance stats
                    communication.emit('synchronization:incoming:performance:' + performanceName + ':' + performanceStatsPeriod + ':stats', employeeId, performanceStats);
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
                },


                function (dailyStatsCallback, monthlyStatsCallback, yearlyStatsCallback, statsCallback) {
                    // listen for employee performance stats changes
                    communication.on('synchronization:outgoing:performance:daily:stats', dailyStatsCallback);
                    communication.on('synchronization:outgoing:performance:monthly:stats', monthlyStatsCallback);
                    communication.on('synchronization:outgoing:performance:yearly:stats', yearlyStatsCallback);
                    communication.on('synchronization:outgoing:performance:alltime:stats', statsCallback);
                }
            );

        });
    },

    stop: function (callback) {
        modules.unloadAll();

        synchronization.stop();

        databases.stopAll();

        logger.info("Stopped dogbot", callback); // force winston to flush logs before stopping
    },

    reload: function (callback) {
        var self = this;

        revision.hasRevisionChanged(function (error, changed, revision) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (changed) {
                    logger.info('Detected new code revision: ' + revision);

                    /*modules.findAllLoadedModulesByType('IO').forEach(function(module) {
                     module.send(null, 'Refreshing my brains with code revision ' + revision);
                     });*/
                }
            }

            self.stop(callback);
        });
    },

    error: function (error, callback) {
        //var traces = stackTrace.parse(error);
        logger.error(error, callback);

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
