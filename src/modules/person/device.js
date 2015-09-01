/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

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
    this.moduleManager.on('synchronization:person:device', this._handleDeviceSynchronization);
    this.moduleManager.on('person:device:is_present', this._isPresent);
};

device.prototype.stop = function () {
    this.moduleManager.removeListener('monitor:arp:create', this._handleArpCreateOrUpdate);
    this.moduleManager.removeListener('monitor:arp:update', this._handleArpCreateOrUpdate);
    this.moduleManager.removeListener('monitor:arp:delete', this._handleArpDelete);
    this.moduleManager.removeListener('person:device:is_present', this._isPresent);
};

device.prototype._isPresent = function (device, callback) {
    function handleArpDiscover() {
        instance.moduleManager.emit('database:monitor:retrieveOne',
            'SELECT * FROM arp WHERE mac_address = ?',
            [device.mac_address],
            function (error, row) {
                if (error) {
                    console.error(error);
                } else {
                    callback(row !== undefined);
                }
            });

        instance.moduleManager.removeListener('monitor:arp:discover:finish', handleArpDiscover);
    }

    instance.moduleManager.on('monitor:arp:discover:finish', handleArpDiscover);
};

device.prototype._handleDeviceSynchronization = function (device) {
    instance.moduleManager.emit('database:person:retrieveAll', 'PRAGMA table_info(device)', [], function (error, rows) {
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

        instance.moduleManager.emit('database:person:retrieveOne',
            'SELECT * FROM device WHERE id = ?',
            [device.id],
            function (error, row) {
                if (error) {
                    console.error(error);
                } else {
                    if (row !== undefined) {

                        keys = _.keys(_.omit(device, 'is_present'));
                        values = _.values(_.omit(device, 'is_present'));

                        instance.moduleManager.emit('database:person:update',
                            'INSERT OR REPLACE INTO device (' + keys + ') VALUES (' + values.map(function () {
                                return '?';
                            }) + ');',
                            values,
                            function (error) {
                                if (error) {
                                    console.error(error);
                                }
                            });
                    } else {

                        instance.moduleManager.emit('database:person:create',
                            'INSERT OR REPLACE INTO device (' + keys + ') VALUES (' + values.map(function () {
                                return '?';
                            }) + ');',
                            values,
                            function (error) {
                                if (error) {
                                    console.error(error);
                                } else {
                                    instance.moduleManager.emit('person:device:is_present', device, function (is_present) {

                                        if (device.is_present != is_present) {
                                            device.is_present = is_present;

                                            if (device.is_present) {
                                                instance._updateById(device.id, device.is_present, function (error) {
                                                    if (error) {
                                                        console.error(error);
                                                    } else {
                                                        instance.moduleManager.emit('person:device:online', device);
                                                    }
                                                });
                                            } else {
                                                instance._updateById(device.id, device.is_present, function (error) {
                                                    if (error) {
                                                        console.error(error);
                                                    } else {
                                                        instance.moduleManager.emit('person:device:offline', device);
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                    }
                }
            });
    });
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
