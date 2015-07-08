/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

function user() {
    var moduleManager = {};
}

user.prototype.type = "PERSON";

user.prototype.name = "user";

user.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

user.prototype.load = function (moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    this.moduleManager.emit('database:person:setup',
        "CREATE TABLE IF NOT EXISTS user (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "name TEXT NOT NULL UNIQUE, " +
        "slack_id TEXT" +
        ");", [],
        function (error) {
            if (error) {
                throw error;
            } else {
                self.start();
            }
        });
};

user.prototype.unload = function () {
    this.stop();
};

user.prototype.start = function () {
    var self = this;

    this.moduleManager.on('person:device:online', function (device) {
        var that = self;

        self._retrieveById(device.user, function (user) {
            // only emit nearby if this is the only device online from the user
            var self = that;
            that._retrieveAllOnlineDevicesById(user.id, function (devices) {
                if (devices && devices.length == 1) {
                    self.moduleManager.emit('person:user:nearby', user);
                }
            })
        });
    });

    this.moduleManager.on('person:device:offline', function (device) {
        var that = self;

        self._retrieveById(device.user, function (user) {
            // only emit farway if the user does not have any other device online
            var self = that;
            that._retrieveAllOnlineDevicesById(user.id, function (devices) {
                if (!devices) {
                    self.moduleManager.emit('person:user:faraway', user);
                }
            })
        });
    });

    this.moduleManager.on('person:slack:active', function (slack) {
        var that = self;

        self._retrieveByName(slack.name, function (user) {
            var self = that;

            if (user === undefined || user === null) {
                that._add(slack.name, slack.slack_id, function (user) {
                    self.moduleManager.emit('person:user:online', user);
                });
            } else {
                that.moduleManager.emit('person:user:online', user);
            }
        });
    });

    this.moduleManager.on('person:slack:away', function (slack) {
        var that = self;

        self._retrieveByName(slack.name, function (user) {
            that.moduleManager.emit('person:user:offline', user);
        });
    });
};

user.prototype.stop = function () {
};

user.prototype._add = function (name, slackId, callback) {
    this.moduleManager.emit('database:person:create',
        "INSERT INTO user (name, slack_id) VALUES (?, ?);", [
            name,
            slackId
        ],
        function (error) {
            if (error) {
                callback(error);
            } else {
                callback({name: name});
            }
        });
};

user.prototype._retrieveById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM user WHERE id = ?;", [id],
        function (error, row) {
            if (error) {
                callback(error);
            } else {
                callback(row);
            }
        });
};

user.prototype._retrieveByName = function (name, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM user WHERE name LIKE ?;", [name],
        function (error, user) {
            if (error) {
                callback(error);
            } else {
                callback(user);
            }
        });
};

user.prototype._retrieveAllOnlineDevicesById = function (id, callback) {
    var self = this;

    this.moduleManager.emit('database:person:retrieveAll',
        'SELECT * FROM device WHERE user = ?;', [id],
        function (error, rows) {
            if (error) {
                callback(error);
            } else {
                if (rows) {
                    var macAddresses = _.pluck(rows, 'mac_address');
                    self.moduleManager.emit('database:monitor:retrieveAll',
                        'SELECT * FROM arp WHERE mac_address IS IN (' + macAddresses + ');',
                        [],
                        function (error, rows) {
                            if (error) {
                                callback(error);
                            } else {
                                callback(null, rows);
                            }
                        });
                }
            }
        });
};

module.exports = new user();
