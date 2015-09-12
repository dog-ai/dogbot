/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var moment = require('moment');

function device() {
    var moduleManager = {};
}

device.prototype.type = "PERSON";

device.prototype.name = "device";

device.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

device.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

device.prototype.unload = function () {
    this.stop();
};

device.prototype.start = function () {
    this.moduleManager.on('person:mac_address:online', this._onMacAddressOnline);
    this.moduleManager.on('person:mac_address:offline', this._onMacAddressOffline);
    this.moduleManager.on('synchronization:person:device', this._onDeviceSynchronization);
    this.moduleManager.on('person:device:is_present', this._isPresent);
};

device.prototype.stop = function () {
    this.moduleManager.removeListener('person:mac_address:online', this._onMacAddressOnline);
    this.moduleManager.removeListener('person:mac_address:offline', this._onMacAddressOffline);
    this.moduleManager.removeListener('synchronization:person:device', this._onDeviceSynchronization);
    this.moduleManager.removeListener('person:device:is_present', this._isPresent);
};

device.prototype._isPresent = function (device, callback) {
    function handleArpDiscover() {
        instance.moduleManager.removeListener('monitor:arp:discover:finish', handleArpDiscover);

        instance._findMacAddressesById(device.id, function (error, mac_addresses) {
            if (error) {
                console.error(error.stack);
            } else {
                if (mac_addresses !== undefined) {
                    var values = _.pluck(mac_addresses, 'id');
                    instance.moduleManager.emit('database:monitor:retrieveAll',
                        'SELECT * FROM arp WHERE mac_address IN (' + values.map(function () {
                            return '?';
                        }) + ');',
                        values,
                        function (error, rows) {
                            if (error) {
                                console.error(error.stack);
                            } else {
                                callback(rows !== undefined && rows !== null && rows.length > 0);
                            }
                        });
                }
            }
        });
    }

    instance.moduleManager.on('monitor:arp:discover:finish', handleArpDiscover);
};

device.prototype._onDeviceSynchronization = function (device) {
    instance.moduleManager.emit('database:person:retrieveAll', 'PRAGMA table_info(device)', [], function (error, rows) {
        if (error !== null) {
            throw error();
        }

        device = _.pick(device, _.pluck(rows, 'name'));

        instance._findById(device.id, function (error, row) {
            if (error) {
                console.error(error.stack);
            } else {
                if (row !== undefined) {

                    if (moment(device.updated_date).isBefore(row.updated_date)) {
                        return;
                    }

                    if (moment(device.updated_date).isAfter(row.updated_date)) {
                        // device has been updated in firebase 'is_present' should not be overridden
                        device = _.omit(device, 'is_present');

                    }
                }

                instance._upsert(device, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        if (device.is_present !== undefined) {

                            instance.moduleManager.emit('person:device:is_present', device, function (is_present) {

                                if (device.is_present != is_present) {
                                    device.is_present = is_present;

                                    if (device.is_present) {
                                        instance._updateById(device.id, device.is_present, function (error) {
                                            if (error) {
                                                console.error(error.stack);
                                            } else {
                                                instance.moduleManager.emit('person:device:online', device);
                                            }
                                        });
                                    } else {
                                        instance._updateById(device.id, device.is_present, function (error) {
                                            if (error) {
                                                console.error(error.stack);
                                            } else {
                                                instance.moduleManager.emit('person:device:offline', device);
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });

            }
        });
    });
};

device.prototype._onMacAddressOnline = function (mac_address) {
    if (mac_address.device_id !== null) {
        instance._findById(mac_address.device_id, function (error, device) {
            if (error !== null) {
                console.error(error.stack);
            } else {
                if (!device.is_present) {
                    device.is_present = true;

                    instance._updateById(device.id, device.is_present, function (error) {
                        if (error) {
                            console.error(error.stack);
                        } else {
                            instance.moduleManager.emit('person:device:online', device);
                        }
                    });
                }
            }
        });
    }
};

device.prototype._onMacAddressOffline = function (mac_address) {
    if (mac_address.device_id !== null) {
        instance._findMacAddressesById(mac_address.device_id, function (error, mac_addresses) {
            if (error) {
                console.error(error.stack);
            } else {
                mac_addresses = _.filter(mac_addresses, _.matches({'is_present': true}));

                if (mac_addresses.length == 0) {
                    instance._findById(mac_address.device_id, function (error, device) {

                        if (error !== null) {
                            console.error(error.stack);
                        } else {
                            device.is_present = false;

                            instance._updateById(device.id, device.is_present, function (error) {
                                if (error) {
                                    console.error(error.stack);
                                } else {
                                    instance.moduleManager.emit('person:device:offline', device);
                                }
                            });
                        }
                    });
                }
            }

        });
    }

};

device.prototype._findMacAddressesById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveAll',
        "SELECT * FROM mac_address WHERE device_id = ?;", [id],
        function (error, rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                });
            }

            callback(error, rows);
        });
};

device.prototype._findById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM device WHERE id = ?;", [id],
        function (error, row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
            }

            callback(error, row);
        });
};

device.prototype._upsert = function (device, callback) {
    if (device.created_date !== undefined && device.created_date !== null) {
        device.created_date = device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }
    if (device.updated_date !== undefined && device.updated_date !== null) {
        device.updated_date = device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(device);
    var values = _.values(device);

    instance.moduleManager.emit('database:person:create',
        'INSERT OR REPLACE INTO device (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values,
        function (error) {
            if (callback !== undefined) {
                callback(error);
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
