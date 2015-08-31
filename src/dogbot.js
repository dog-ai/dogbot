/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

var stackTrace = require('stack-trace');
var moment = require('moment');

var communication = require('./utils/communication.js');
var revision = require('./utils/revision.js');
var synchronization = require('./utils/synchronization.js');

var databases = require('./databases.js')(communication);
var modules = require('./modules.js')(communication);

var dogbot = {
    id: undefined,

    start: function (callback) {
        databases.startAll(function () {
        });

        _.defer(function () {

            communication.emit('database:auth:setup',
                "CREATE TABLE IF NOT EXISTS google (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "user_id TEXT NOT NULL, " +
                "name TEXT NOT NULL, " +
                "email TEXT NOT NULL, " +
                "access_token TEXT NOT NULL, " +
                "expires_in INTEGER NOT NULL, " +
                "refresh_token TEXT NOT NULL" +
                ");",
                [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });

            communication.emit('database:monitor:setup',
                "CREATE TABLE IF NOT EXISTS arp (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "ip_address TEXT NOT NULL UNIQUE, " +
                "mac_address TEXT NOT NULL" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });

            communication.emit('database:monitor:setup',
                "CREATE TABLE IF NOT EXISTS bonjour (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "type TEXT NOT NULL, " +
                "name TEXT NOT NULL, " +
                "hostname TEXT NOT NULL, " +
                "ip_address TEXT NOT NULL, " +
                "port INTEGER, " +
                "txt TEXT NOT NULL, " +
                "UNIQUE(type, name)" +
                ");", [], function (error) {
                    if (error) {
                        console.error(error);
                    }
                });

            communication.emit('database:monitor:setup',
                "CREATE TABLE IF NOT EXISTS ip (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "ip_address TEXT NOT NULL UNIQUE" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });

            communication.emit('database:monitor:setup',
                "CREATE TABLE IF NOT EXISTS slack (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "slack_id TEXT NOT NULL UNIQUE, " +
                "username TEXT NOT NULL, " +
                "name TEXT NOT NULL" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });


            communication.emit('database:person:setup',
                "CREATE TABLE IF NOT EXISTS device (" +
                "id TEXT PRIMARY KEY NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "employee_id INTEGER REFERENCES employee(id), " +
                "mac_address TEXT NOT NULL, " +
                "is_present INTEGER NOT NULL DEFAULT 0, " +
                "UNIQUE(employee_id, mac_address)" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });

            communication.emit('database:person:setup',
                "CREATE TABLE IF NOT EXISTS employee (" +
                "id TEXT PRIMARY KEY NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "name TEXT NOT NULL UNIQUE, " +
                "is_present INTEGER NOT NULL DEFAULT 0, " +
                "slack_id TEXT" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });


            communication.emit('database:performance:setup',
                "CREATE TABLE IF NOT EXISTS presence (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "employee_id TEXT NOT NULL, " +
                "is_present INTEGER NOT NULL, " +
                "is_synced INTEGER NOT NULL DEFAULT 0, " +
                "UNIQUE(created_date, employee_id)" +
                ");", [],
                function (error) {
                    if (error) {
                        console.error(error);
                    }
                });
        });


        synchronization.start(this.id, function (error) {
                if (error !== null) {
                    console.error(error.message);

                    modules.loadAll();
                }

                callback();
            },
            function (type, moduleName, configuration) {
                modules.loadModule(type, moduleName, configuration, true);
            },
            function (device) {
                communication.emit('database:person:retrieveAll', 'PRAGMA table_info(device)', [], function (error, rows) {
                    if (error !== null) {
                        throw error();
                    }

                    device = _.pick(device, _.pluck(rows, 'name'));

                    if (device.created_date !== undefined && device.created_date !== null) {
                        device.created_date = device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
                    }
                    if (device.updated_date !== undefined && device.updated_date !== null) {
                        device.updated_date = device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
                    }

                    var keys = _.keys(device);
                    var values = _.values(device);

                    communication.emit('database:person:create',
                        'INSERT OR REPLACE INTO device (' + _.union(keys, ['is_present']) + ') VALUES (' + values.map(function () {
                            return '?'
                        }) + ',(SELECT is_present FROM employee WHERE id = ?))',
                        values.concat([values[0]]),
                        function (error) {
                            if (error) {
                                throw error;
                            }
                        });
                });
            },
            function (device) {

            },
            function (employee) {
                communication.emit('synchronization:person:employee', employee);
            },
            function (employee) {
            },
            function (callback) {
                communication.emit('database:performance:retrieveOneByOne',
                    'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
                        if (error) {
                            console.error(error);
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
                                                    console.error(error);
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
            }
        );
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

module.exports = function (id) {
    dogbot.id = id;
    return dogbot;
};
