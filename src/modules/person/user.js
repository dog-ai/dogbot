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
        "name TEXT NOT NULL UNIQUE" +
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

        self._retrieve(device.user, function (user) {
            that.moduleManager.emit('person:user:online', user);
        });
    });

    this.moduleManager.on('person:device:offline', function (device) {
        var that = self;

        self._retrieve(device.user, function (user) {
            that.moduleManager.emit('person:user:offline', user);
        });
    });
};

user.prototype.stop = function () {
};

user.prototype._retrieve = function (userId, callback) {
    this.moduleManager.emit('database:person:retrieve',
        "SELECT * FROM user WHERE id = ?;", [userId],
        function (error, row) {
            if (error !== null) {
                throw error;
            } else {
                if (row !== undefined) {
                    callback(row);
                }
            }
        });
};

module.exports = new user();
