/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function device() {
    var moduleManager = {};
}

device.prototype.type = "PERSON";

device.prototype.name = "device";

device.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

device.prototype.load = function(moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    this.moduleManager.emit('database:person:setup',
        "CREATE TABLE IF NOT EXISTS device (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "user INTEGER REFERENCES user(id), " +
        "mac_address TEXT NOT NULL, " +
        "UNIQUE(user, mac_address)" +
        ");", [],
        function (error) {
            if (error) {
                throw error;
            } else {
                self.start();
            }
        });
};

device.prototype.unload = function() {
    this.stop();
};

device.prototype.start = function() {
    var self = this;

    this.moduleManager.on('monitor:macAddress:create', function (macAddress) {
        var that = self;

        self._retrieve(macAddress, function (device) {
            that.moduleManager.emit('person:device:online', device);
        });
    });

    this.moduleManager.on('monitor:macAddress:delete', function (macAddress) {
        var that = self;


        self._retrieve(macAddress, function (device) {
            that.moduleManager.emit('person:device:offline', device);
        });
    });
};

device.prototype.stop = function() {
};

device.prototype._retrieve = function (macAddress, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM device WHERE mac_address = ?;", [macAddress],
        function (error, row) {
            if (error) {
                throw error;
            } else {
                if (row) {
                    callback(row);
                }
            }
        });
};

module.exports = new device();
