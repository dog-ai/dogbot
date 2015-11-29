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
    // retrieve existing device or start with a blank one with is_manual=false
    // if retrieved device is is_manual=true then the party is over

    instance._findByMacAddress(macAddress.address)
        .then(function (device) {
            if (device === undefined || !device.is_manual) {

                return instance._findIpAdressByMacAddress(macAddress.address)
                    .then(function (row) {
                        if (row === undefined || row === null) {
                            throw new Error('Unknown IP address for MAC address: ' + macAddress.address);
                        }

                        return Promise.props({
                            mdns: instance._execDig(row.ip_address),
                            nmap: instance._execNmap(row.ip_address),
                            dns: instance._execHost(row.ip_address)
                        });
                    })
                    .then(function (result) {
                        logger.debug(JSON.stringify("Discovery result: " + JSON.stringify(result)));

                        device = device || {};

                        if (result.mdns.hostname !== undefined && result.mdns.hostname !== null) {
                            device.name = result.mdns.hostname.replace('-', ' ');
                        } else if (result.dns.hostname !== undefined) {
                            if (device.name !== undefined) {
                                device.name = result.dns.hostname;
                            }
                        }

                        if (result.nmap.type !== undefined && result.nmap.type !== null) {
                            if (device.type === undefined || result.nmap.type.length > device.type.length) {
                                device.type = result.nmap.type instanceof Array ? result.nmap.type[result.nmap.type.length - 1] : result.nmap.type;
                            }
                        }

                        if (result.nmap.os !== undefined && result.nmap.os !== null) {
                            device.os = result.nmap.os;
                        }

                        if (device.name !== undefined && device.type !== undefined && device.os !== undefined) {
                            device.last_presence_date = new Date();
                            return instance._add(device);
                        }
                    })
            }


        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

device.prototype._execDig = function (ip) {
    return new Promise(function (resolve, reject) {
        var result = {};

        var spawn = require('child_process').spawn,
            _process = spawn('dig', [
                '+short',
                '+time=1',
                '+tries=0',
                '+retry=0',
                '@224.0.0.251',
                '-p5353',
                '-x', ip
            ]);

        _process.stdout.setEncoding('utf8');
        _process.stdout.pipe(require('split')()).on('data', function (line) {
            if (line !== null && line.length !== 0) {
                if (line.indexOf('.local.') !== -1) {
                    result.hostname = line.split('.')[0];
                }
            }
        });

        _process.on('error', reject);
        _process.on('exit', function () {
            resolve(result);
        });
    })
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
        var last_presence_date = device.last_presence_date;

        instance._findById(device.id)
            .then(function (row) {
                if (row !== undefined) {

                    if (moment(device.updated_date).isAfter(row.updated_date)) {

                        if (row.employee_id !== null && device.employee_id === undefined) {
                            device.employee_id = null;
                        }

                        device = _.omit(device, 'is_present', 'last_presence_date');

                        instance._updateById(device.id, device, function (error) {
                            if (error) {
                                logger.error(error.stack);
                            } else {

                                device = _.extend(device, {
                                    is_present: row.is_present,
                                    last_presence_date: row.last_presence_date
                                });

                                if (row.employee_id !== null && device.employee_id === null) {
                                    instance.communication.emit('person:device:removedFromEmployee', device, {id: row.employee_id});
                                } else if (row.employee_id === null && device.employee_id !== null) {
                                    instance.communication.emit('person:device:addedToEmployee', device, {id: device.employee_id});
                                }
                            }
                        });
                    }
                } else {
                    return instance._add(device)
                        .then(function () {
                            if (device.is_present) {
                                instance.communication.emit('person:device:is_present', device, function (is_present) {

                                    if (!is_present) {

                                        device.updated_date = new Date();
                                        device.is_present = false;

                                        instance._updateById(device.id, device, function (error) {
                                            if (error) {
                                                logger.error(error.stack);
                                            } else {
                                                device.last_presence_date = last_presence_date;

                                                instance.communication.emit('person:device:offline', device);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    });
};

device.prototype._onDeleteDeviceIncomingSynchronization = function (device) {
    instance.communication.emit('database:person:delete',
        'SELECT * FROM device WHERE id = ?',
        [device.id], function (error, row) {
            if (error) {
                logger.error(error.stack);
            } else {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }

                instance.communication.emit('database:person:delete',
                    'DELETE FROM device WHERE id = ?',
                    [device.id], function (error) {
                        if (error) {
                            logger.error(error.stack);
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
        instance._findById(mac_address.device_id)
            .then(function (device) {
                if (device !== undefined && !device.is_present) {
                    device.updated_date = new Date();
                    device.is_present = true;
                    device.last_presence_date = mac_address.last_presence_date;

                    instance._updateById(device.id, device, function (error) {
                        if (error) {
                            logger.error(error.stack);
                        } else {
                            device.last_presence_date = mac_address.last_presence_date;
                            instance.communication.emit('person:device:online', device);
                        }
                    });
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
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
                        instance._findById(mac_address.device_id)
                            .then(function (device) {
                                device.updated_date = new Date();
                                device.is_present = false;
                                device.last_presence_date = mac_address.last_presence_date;

                                instance._updateById(device.id, device, function (error) {
                                    if (error) {
                                        logger.error(error.stack);
                                    } else {
                                        instance.communication.emit('person:device:offline', device);
                                    }
                                });
                            })
                            .catch(function (error) {
                                logger.error(error.stack);
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
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                });
            }

            callback(error, rows);
        });
};

device.prototype._findIpAdressByMacAddress = function (macAddress) {
    return this.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT ip_address FROM arp WHERE mac_address = ?;", [macAddress]);
};

device.prototype._findById = function (id) {
    return this.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM device WHERE id = ?;", [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }
            }

            return row;
        });
};

device.prototype._findByMacAddress = function (macAddress) {
    return this.communication.emitAsync('database:person:retrieveOne',
        "SELECT d.* FROM device d, mac_address ma WHERE d.id = ma.device_id AND ma.address = ?;", [macAddress])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }
            }

            return row;
        });
};

device.prototype._add = function (device) {
    if (device.created_date !== undefined && device.created_date !== null && device.created_date instanceof Date) {
        device.created_date = device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (device.updated_date !== undefined && device.updated_date !== null && device.updated_date instanceof Date) {
        device.updated_date = device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (device.last_presence_date !== undefined && device.last_presence_date !== null && device.last_presence_date instanceof Date) {
        device.last_presence_date = device.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(device);
    var values = _.values(device);

    return instance.communication.emitAsync('database:person:create',
        'INSERT INTO device (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values);
};

device.prototype._updateById = function (id, device, callback) {
    var _device = _.clone(device);

    if (_device.created_date !== undefined && _device.created_date !== null && _device.created_date instanceof Date) {
        _device.created_date = _device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_device.updated_date !== undefined && _device.updated_date !== null && _device.updated_date instanceof Date) {
        _device.updated_date = _device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_device.last_presence_date !== undefined && _device.last_presence_date !== null && _device.last_presence_date instanceof Date) {
        _device.last_presence_date = _device.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_device);
    var values = _.values(_device);

    instance.communication.emit('database:person:update',
        'UPDATE device SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values, callback);
};

var instance = new device();

module.exports = instance;
