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
    this.moduleManager.on('monitor:arp:create', this._handleArpCreateOrUpdate);
    this.moduleManager.on('monitor:arp:update', this._handleArpCreateOrUpdate);
    this.moduleManager.on('monitor:arp:delete', this._handleArpDelete);
};

device.prototype.stop = function () {
    this.moduleManager.removeListener('monitor:arp:create', this._handleArpCreateOrUpdate);
    this.moduleManager.removeListener('monitor:arp:update', this._handleArpCreateOrUpdate);
    this.moduleManager.removeListener('monitor:arp:delete', this._handleArpDelete);
};

device.prototype._handleArpCreateOrUpdate = function (mac_address) {
    instance._findByMacAddress(mac_address, function (error, device) {

        if (error !== null) {
            console.error(error);
        } else {
            if (!device.is_present) {
                device.is_present = true;

                instance._updateById(device.id, device.is_present, function (error) {
                    if (error) {
                        console.error(error);
                    } else {
                        instance.moduleManager.emit('person:device:online', device);
                    }
                });
            }
        }
    });
};

device.prototype._handleArpDelete = function (mac_address) {
    instance._findByMacAddress(mac_address, function (error, device) {

        if (error !== null) {
            console.error(error.message);
        } else {
            device.is_present = false;

            instance._updateById(device.id, device.is_present, function (error) {
                if (error) {
                    console.error(error);
                } else {
                    instance.moduleManager.emit('person:device:offline', device);
                }
            });
        }
    });
};

device.prototype._findByMacAddress = function (mac_address, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM device WHERE mac_address = ?;", [mac_address], function (error, row) {
            if (error) {
                if (callback !== undefined) {
                    callback(error);
                }
            } else {
                if (row) {
                    if (callback !== undefined) {
                        callback(error, row);
                    }
                }
            }
        });
};

device.prototype._updateById = function (id, is_present, callback) {
    var updated_date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:person:update',
        "UPDATE device SET updated_date = ?, is_present = ? WHERE id = ?;",
        [updated_date, is_present, id], function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

var instance = new device();

module.exports = instance;
