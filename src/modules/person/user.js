/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

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
            if (error !== undefined && error !== null) {
                throw new Error(error);
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
            // TODO: only emit nearby if this is the only device online from the user
            that.moduleManager.emit('person:user:nearby', user);
        });
    });

    this.moduleManager.on('person:device:offline', function (device) {
        var that = self;

        self._retrieveById(device.user, function (user) {
            // TODO only emit farway if the user does not have any other device online
            that.moduleManager.emit('person:user:faraway', user);
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
            if (error !== null) {
                throw error;
            } else {
                callback({name: name});
            }
        });
};

user.prototype._retrieveById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieve',
        "SELECT * FROM user WHERE id = ?;", [id],
        function (error, user) {
            if (error !== null) {
                throw error;
            } else {
                if (user !== undefined) {
                    callback(user);
                }
            }
        });
};

user.prototype._retrieveByName = function (name, callback) {
    this.moduleManager.emit('database:person:retrieve',
        "SELECT * FROM user WHERE name LIKE ?;", [name],
        function (error, user) {
            if (error !== null) {
                throw error;
            } else {
                callback(user);
            }
        });
};

module.exports = new user();
