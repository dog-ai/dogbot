/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment'),
    Promise = require('bluebird');


function device() {
}

device.prototype.type = "PERSON";

device.prototype.name = "device";

device.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

device.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

device.prototype.unload = function () {
    this.stop();
};

device.prototype.start = function () {
    this.communication.on('person:mac_address:online', this._onMacAddressOnline);
    this.communication.on('person:mac_address:offline', this._onMacAddressOffline);
    this.communication.on('synchronization:incoming:person:device:createOrUpdate', this._onCreateOrUpdateDeviceIncomingSynchronization);
    this.communication.on('synchronization:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
    this.communication.on('person:device:is_present', this._isPresent);
    this.communication.on('person:device:discover', this._discover);
};

device.prototype.stop = function () {
    this.communication.removeListener('person:mac_address:online', this._onMacAddressOnline);
    this.communication.removeListener('person:mac_address:offline', this._onMacAddressOffline);
    this.communication.removeListener('synchronization:incoming:person:device:createOrUpdate', this._onCreateOrUpdateDeviceIncomingSynchronization);
    this.communication.removeListener('synchronization:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
    this.communication.removeListener('person:device:is_present', this._isPresent);
    this.communication.removeListener('person:device:discover', this._discover);
};

device.prototype._discover = function (macAddress, callback) {
    var device = {};

    instance._findIpAdressByMacAddress(macAddress.address)
        .then(function (row) {
            if (row === undefined || row === null) {
                throw new Error('Unknown IP address for MAC address: ' + macAddress.address);
            }

            device.ip = row.ip_address;
            device.mac_address = macAddress.address;
            device.vendor = macAddress.vendor;

            return instance._execNmap(row.ip_address).then(function (result) {
                    device = _.extend(device, result);
                })
                .then(instance._execHost(row.ip_address)
                    .then(function (result) {
                        device = _.extend(device, result);
                    }))
                .then(function () {
                    return device;
                });
        })
        .then(function (device) {
            console.log(JSON.stringify(device));

            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

device.prototype._execHost = function (ip) {
    return new Promise(function (resolve, reject) {
        var result = {};

        var spawn = require('child_process').spawn,
            _process = spawn('host', [
                ip
            ]);

        _process.stdout.setEncoding('utf8');
        _process.stdout.pipe(require('split')()).on('data', function (line) {
            if (line !== null && line.length !== 0) {
                if (line.indexOf('domain name pointer') !== -1) {
                    result.hostname = line.split(' ')[4];
                    result.hostname = result.hostname.split('.')[0];
                }
            }
        });

        _process.on('error', reject);
        _process.on('exit', function () {
            resolve(result);
        });
    })
};

device.prototype._execNmap = function (ip) {
    return new Promise(function (resolve, reject) {

        var result = {};

        var spawn = require('child_process').spawn,
            _process = spawn('nmap', [
                '-sV',
                '-O',
                '-v',
                '--osscan-guess',
                '--max-os-tries=3',
                ip
            ]);

        _process.stdout.setEncoding('utf8');
        _process.stdout.pipe(require('split')()).on('data', function (line) {
            if (line !== null && line.length === 0) {

            } else {

                if (line.indexOf('Device type:') == 0) {
                    result.type = line.split(': ')[1];
                    if (result.type.indexOf('|') !== -1) {
                        result.type = result.type.split('|');
                    }
                }

                if (line.indexOf('Running:') == 0) {
                    result.os = line.split(': ')[1];
                    result.os = result.os.replace(/(\s)?[\w]+\.[\w]+(\.[\w]+)?/g, '').replace(/\|/g, '');
                    if (result.os.indexOf(', ') !== -1) {
                        result.os = result.os.split(', ');
                    }
                }
            }
        });

        _process.on('error', reject);
        _process.on('exit', function () {
            resolve(result);
        });
    })
};

device.prototype._isPresent = function (device, callback) {
    function handleArpDiscover() {
        instance.communication.removeListener('monitor:arp:discover:finish', handleArpDiscover);

        instance._findMacAddressesById(device.id, function (error, mac_addresses) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (mac_addresses !== undefined) {
                    var values = _.pluck(mac_addresses, 'address');
                    instance.communication.emit('database:monitor:retrieveAll',
                        'SELECT * FROM arp WHERE mac_address IN (' + values.map(function () {
                            return '?';
                        }) + ');',
                        values,
                        function (error, rows) {
                            if (error) {
                                logger.error(error.stack);
                            } else {
                                callback(rows !== undefined && rows !== null && rows.length > 0);
                            }
                        });
                }
            }
        });
    }

    instance.communication.on('monitor:arp:discover:finish', handleArpDiscover);
};

device.prototype._onCreateOrUpdateDeviceIncomingSynchronization = function (device) {
    instance.communication.emit('database:person:retrieveAll', 'PRAGMA table_info(device)', [], function (error, rows) {
        if (error !== null) {
            throw error();
        }

        device = _.pick(device, _.pluck(rows, 'name'));

        instance._findById(device.id, function (error, row) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (row !== undefined) {

                    if (moment(device.updated_date).isAfter(row.updated_date)) {

                        if (row.employee_id !== null && device.employee_id === undefined) {
                            device.employee_id = null;
                        }

                        device = _.omit(device, 'is_present');

                        instance._updateById(device.id, device, function (error) {
                            if (error) {
                                logger.error(error.stack);
                            } else {

                                device = _.extend(device, {is_present: row.is_present});

                                if (row.employee_id !== null && device.employee_id === null) {
                                    instance.communication.emit('person:device:removedFromEmployee', device, {id: row.employee_id});
                                } else if (row.employee_id === null && device.employee_id !== null) {
                                    instance.communication.emit('person:device:addedToEmployee', device, {id: device.employee_id});
                                }
                            }
                        });
                    }
                } else {
                    instance._add(device, function (error) {
                        if (error) {
                            logger.error(error.stack);
                        } else {
                            instance.communication.emit('person:device:is_present', device, function (is_present) {

                                if (device.is_present != is_present) {

                                    device.updated_date = new Date();
                                    device.is_present = is_present;

                                    instance._updateById(device.id, device, function (error) {
                                        if (error) {
                                            logger.error(error.stack);
                                        } else {
                                            if (device.is_present) {
                                                instance.communication.emit('person:device:online', device);
                                            } else {
                                                instance.communication.emit('person:device:offline', device);
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
                logger.error(error);
            } else {
                instance.communication.emit('database:person:delete',
                    'DELETE FROM device WHERE id = ?',
                    [device.id], function (error) {
                        if (error) {
                            logger.error(error);
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
                logger.error(error.stack);
            } else {

                if (device !== undefined && !device.is_present) {
                    device.updated_date = new Date();
                    device.is_present = true;

                    instance._updateById(device.id, device, function (error) {
                        if (error) {
                            logger.error(error.stack);
                        } else {
                            instance.communication.emit('person:device:online', device);
                        }
                    });
                }
            }
        });
    }

    instance.communication.emit('worker:job:enqueue', 'person:device:discover', mac_address, null, false);

};

device.prototype._onMacAddressOffline = function (mac_address) {
    if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
        instance._findMacAddressesById(mac_address.device_id, function (error, mac_addresses) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (mac_addresses !== undefined) {
                    mac_addresses = _.filter(mac_addresses, _.matches({'is_present': 1}));

                    if (mac_addresses.length == 0) {
                        instance._findById(mac_address.device_id, function (error, device) {
                            if (error !== null) {
                                logger.error(error.stack);
                            } else {

                                device.updated_date = new Date();
                                device.is_present = false;

                                instance._updateById(device.id, device, function (error) {
                                    if (error) {
                                        logger.error(error.stack);
                                    } else {
                                        instance.communication.emit('person:device:offline', device);
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
    this.communication.emit('database:person:retrieveAll',
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

device.prototype._findIpAdressByMacAddress = function (macAddress) {
    return this.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT ip_address FROM arp WHERE mac_address = ?;", [macAddress]);
};

device.prototype._findById = function (id, callback) {
    this.communication.emit('database:person:retrieveOne',
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

    instance.communication.emit('database:person:create',
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

    instance.communication.emit('database:person:update',
        'UPDATE device SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values, callback);
};

var instance = new device();

module.exports = instance;
