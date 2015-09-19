/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
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
    this.moduleManager.on('synchronization:incoming:person:device:createOrUpdate', this._onCreateOrUpdateDeviceIncomingSynchronization);
    this.moduleManager.on('synchronization:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
    this.moduleManager.on('person:device:is_present', this._isPresent);
};

device.prototype.stop = function () {
    this.moduleManager.removeListener('person:mac_address:online', this._onMacAddressOnline);
    this.moduleManager.removeListener('person:mac_address:offline', this._onMacAddressOffline);
    this.moduleManager.removeListener('synchronization:incoming:person:device:createOrUpdate', this._onCreateOrUpdateDeviceIncomingSynchronization);
    this.moduleManager.removeListener('synchronization:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
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
                    var values = _.pluck(mac_addresses, 'address');
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

device.prototype._onCreateOrUpdateDeviceIncomingSynchronization = function (device) {
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

                    if (moment(device.updated_date).isAfter(row.updated_date)) {

                        if (row.employee_id !== null && device.employee_id === undefined) {
                            device.employee_id = null;
                        }

                        device = _.omit(device, 'is_present');

                        instance._updateById(device.id, device, function (error) {
                            if (error) {
                                console.error(error.stack);
                            } else {

                                device = _.extend(device, {is_present: row.is_present});

                                if (row.employee_id !== null && device.employee_id === null) {
                                    instance.moduleManager.emit('person:device:removedFromEmployee', device, {id: row.employee_id});
                                } else if (row.employee_id === null && device.employee_id !== null) {
                                    instance.moduleManager.emit('person:device:addedToEmployee', device, {id: device.employee_id});
                                }
                            }
                        });
                    }
                } else {
                    instance._add(device, function (error) {
                        if (error) {
                            console.error(error.stack);
                        } else {
                            instance.moduleManager.emit('person:device:is_present', device, function (is_present) {

                                if (device.is_present != is_present) {

                                    device.updated_date = new Date();
                                    device.is_present = is_present;

                                    instance._updateById(device.id, device, function (error) {
                                        if (error) {
                                            console.error(error.stack);
                                        } else {
                                            if (device.is_present) {
                                                instance.moduleManager.emit('person:device:online', device);
                                            } else {
                                                instance.moduleManager.emit('person:device:offline', device);
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    });
};

device.prototype._onDeleteDeviceIncomingSynchronization = function (device) {
    instance.communication.emit('database:person:delete',
        'SELECT * FROM device WHERE id = ?',
        [device.id], function (error, row) {
            if (error) {
                console.error(error);
            } else {
                instance.communication.emit('database:person:delete',
                    'DELETE FROM device WHERE id = ?',
                    [device.id], function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            if (row.is_present) {
                                instance.communication.emit('person:device:offline', row);
                            }
                        }
                    });
            }
        });
};

device.prototype._onMacAddressOnline = function (mac_address) {
    if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
        instance._findById(mac_address.device_id, function (error, device) {
            if (error !== null) {
                console.error(error.stack);
            } else {

                if (device !== undefined && !device.is_present) {
                    device.updated_date = new Date();
                    device.is_present = true;

                    instance._updateById(device.id, device, function (error) {
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
    if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
        instance._findMacAddressesById(mac_address.device_id, function (error, mac_addresses) {
            if (error) {
                console.error(error.stack);
            } else {
                if (mac_addresses !== undefined) {
                    mac_addresses = _.filter(mac_addresses, _.matches({'is_present': 1}));

                    if (mac_addresses.length == 0) {
                        instance._findById(mac_address.device_id, function (error, device) {
                            if (error !== null) {
                                console.error(error.stack);
                            } else {

                                device.updated_date = new Date();
                                device.is_present = false;

                                instance._updateById(device.id, device, function (error) {
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
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
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

device.prototype._add = function (device, callback) {
    if (device.created_date !== undefined && device.created_date !== null && device.created_date instanceof Date) {
        device.created_date = device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (device.updated_date !== undefined && device.updated_date !== null && device.updated_date instanceof Date) {
        device.updated_date = device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(device);
    var values = _.values(device);

    instance.moduleManager.emit('database:person:create',
        'INSERT INTO device (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values, callback);
};

device.prototype._updateById = function (id, device, callback) {
    if (device.created_date !== undefined && device.created_date !== null && device.created_date instanceof Date) {
        device.created_date = device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (device.updated_date !== undefined && device.updated_date !== null && device.updated_date instanceof Date) {
        device.updated_date = device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(device);
    var values = _.values(device);

    instance.moduleManager.emit('database:person:update',
        'UPDATE device SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values, callback);
};

var instance = new device();

module.exports = instance;
