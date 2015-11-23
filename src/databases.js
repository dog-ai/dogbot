/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('./utils/logger.js');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var fs = require("fs");

var databasesDir = path.join(__dirname, 'databases/');

function databases() {
}

databases.prototype.startAll = function (callback) {
    var self = this;

    self.types.forEach(function (type) {
        self._startAllByType(type);
    });

    async.series([
        function (callback) {
            self.communication.emit('database:auth:setup', 'DROP TABLE IF EXISTS google', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:auth:setup',
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
                        [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:monitor:setup', 'DROP TABLE IF EXISTS arp', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:monitor:setup',
                        "CREATE TABLE arp (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "ip_address TEXT NOT NULL, " +
                        "mac_address TEXT NOT NULL," +
                        "UNIQUE(ip_address, mac_address)" +
                        ");",
                        [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:monitor:setup', 'DROP TABLE IF EXISTS bonjour', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:monitor:setup',
                        "CREATE TABLE bonjour (" +
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
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:monitor:setup', 'DROP TABLE IF EXISTS ip', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:monitor:setup',
                        "CREATE TABLE ip (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "ip_address TEXT NOT NULL UNIQUE" +
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:monitor:setup', 'DROP TABLE IF EXISTS slack', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:monitor:setup',
                        "CREATE TABLE slack (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "slack_id TEXT NOT NULL UNIQUE, " +
                        "username TEXT NOT NULL, " +
                        "name TEXT NOT NULL" +
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:person:setup', 'DROP TABLE IF EXISTS mac_address', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:person:setup',
                        "CREATE TABLE mac_address (" +
                        "id TEXT DEFAULT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "address TEXT PRIMARY KEY NOT NULL, " +
                        "device_id TEXT DEFAULT NULL, " +
                        "vendor TEXT DEFAULT NULL, " +
                        "is_present INTEGER NOT NULL DEFAULT 0, " +
                        "last_presence_date DATETIME DEFAULT NULL," +
                        "is_to_be_deleted INTEGER NOT NULL DEFAULT 0," +
                        "is_synced INTEGER NOT NULL DEFAULT 0" +
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:person:setup', 'DROP TABLE IF EXISTS device', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:person:setup',
                        "CREATE TABLE device (" +
                        "id TEXT PRIMARY KEY NOT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "employee_id INTEGER REFERENCES employee(id), " +
                        "is_present INTEGER NOT NULL DEFAULT 0, " +
                        "is_manual INTEGER NOT NULL DEFAULT 0, " +
                        "last_presence_date DATETIME" +
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:person:setup', 'DROP TABLE IF EXISTS employee', [], function (error) {
                if (error) {
                    callback(error);
                } else {
                    self.communication.emit('database:person:setup',
                        "CREATE TABLE employee (" +
                        "id TEXT PRIMARY KEY NOT NULL, " +
                        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                        "full_name TEXT NOT NULL UNIQUE, " +
                        "is_present INTEGER NOT NULL DEFAULT 0, " +
                        "slack_id TEXT" +
                        ");", [], callback);
                }
            });
        },
        function (callback) {
            self.communication.emit('database:performance:setup',
                "CREATE TABLE IF NOT EXISTS presence (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
                "employee_id TEXT NOT NULL, " +
                "is_present INTEGER NOT NULL, " +
                "is_synced INTEGER NOT NULL DEFAULT 0, " +
                "UNIQUE(created_date, employee_id)" +
                ");", [], callback);
        }
    ], function (error) {
        if (error) {
            logger.error(error.stack);
        }

        callback(self.started);
    });
};

databases.prototype._startAllByType = function (type) {
    var self = this;

    var dir = path.join(databasesDir + type.toLowerCase());

    fs.readdirSync(dir).forEach(function (file) {
        self._start(type, file);
    });


};

databases.prototype._start = function (type, file) {
    var self = this;

    try {
        var database = require(databasesDir + type.toLowerCase() + '/' + file);

        database.start(self.communication);
        self.started.push(database);

        logger.info('Started ' + type.toLowerCase() + ' database: ' + database.name);
    } catch (error) {
        logger.info('Unable to start ' + type.toLowerCase() + ' database ' + file + ' because ' + error.message);
    }
};

databases.prototype.stopAll = function () {
    var self = this;

    self.started.forEach(function (database) {
        self._stop(database);
    });
};

databases.prototype._stop = function (database) {
    try {
        database.stop();
        logger.info('Stopped database: ' + database.name);
    } catch (exception) {
        logger.info('Unable to stop database ' + database.name + ' because ' + exception.message);
    }
};

module.exports = function (communication) {
    var instance = new databases();

    instance.communication = communication;
    instance.started = [];
    instance.types = (fs.readdirSync(databasesDir) || []).filter(function (type) {
        if (type.indexOf('.') > -1) {
            return false;
        } else {
            return true;
        }
    }).map(function (type) {
        return type.toUpperCase();
    });

    return instance;
};