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
    this.moduleManager = moduleManager;

    this.start();
};

device.prototype.unload = function() {
    this.stop();
};

device.prototype.start = function() {
    this.moduleManager.on('monitor:macAddress:create', this._online);
    this.moduleManager.on('monitor:macAddress:delete', this._offline);
};

device.prototype.stop = function() {
};

device.prototype._online = function(macAddress) {
    var self = this;

    console.log(new Date() + ' ' + macAddress + ' just came online');

    this._retrieve(macAddress, function (name) {
        self.emit('person:device:online', name);
    });
};

device.prototype._offline = function(macAddress) {
    var self = this;

    console.log(new Date() + ' ' + macAddress + ' just went offline');

    this._retrieve(macAddress, function (name) {
        self.emit('person:device:offline', name);
    });
};

device.prototype._retrieve = function (macAddress, callback) {
    this.moduleManager.emit('database:person:retrieve',
        "SELECT u.name FROM user u, device d WHERE u.id = d.user AND d.mac_address = ?;", [macAddress],
        function (error, row) {
            if (error !== null) {
                throw error;
            } else {
                if (row !== undefined) {
                    callback(row.name);
                }
            }
        });
};

module.exports = new device();
