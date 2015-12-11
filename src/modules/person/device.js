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
    this.communication.on('synchronization:outgoing:person:device', this._onDeviceOutgoingSynchronization);
};

device.prototype.stop = function () {
    this.communication.removeListener('person:mac_address:online', this._onMacAddressOnline);
    this.communication.removeListener('person:mac_address:offline', this._onMacAddressOffline);
    this.communication.removeListener('synchronization:incoming:person:device:createOrUpdate', this._onCreateOrUpdateDeviceIncomingSynchronization);
    this.communication.removeListener('synchronization:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
    this.communication.removeListener('person:device:is_present', this._isPresent);
    this.communication.removeListener('person:device:discover', this._discover);
    this.communication.removeListener('synchronization:outgoing:person:device', this._onDeviceOutgoingSynchronization);
};

device.prototype._discover = function (macAddress, callback) {
    return instance._findByMacAddress(macAddress.address)
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
                            dns: instance._execHost(row.ip_address),
                            bonjours: instance._findAllBonjoursByIpAddress(row.ip_address),
                            upnps: instance._findAllUPnPsByIpAddress(row.ip_address)
                        });
                    })
                    .then(function (result) {
                        var _device = device || {};

                        var bonjour =
                            _.find(result.bonjours, {type: '_apple-mobdev2._tcp'}) ||
                            _.find(result.bonjours, {type: '_afpovertcp._tcp'}) ||
                            _.find(result.bonjours, {type: '_smb._tcp'}) ||
                            _.find(result.bonjours, {type: '_googlecast._tcp'});

                        if (result.dns.hostname !== undefined && result.dns.hostname !== null && result.dns.hostname.length > 0) {
                            _device.name = result.dns.hostname;
                        }

                        if (result.mdns.hostname !== undefined && result.mdns.hostname !== null && result.mdns.hostname > 0) {
                            _device.name = result.mdns.hostname;
                        }

                        if (result.upnps !== undefined && result.upnps.length > 0 && result.upnps[0].device_friendly_name !== undefined && result.upnps[0].device_friendly_name !== null) {
                            _device.name = result.upnps[0].device_friendly_name;
                        }

                        if (bonjour !== undefined && bonjour.hostname !== undefined && bonjour.hostname !== null && bonjour.hostname.length > 0) {
                            _device.name = bonjour.hostname;
                        }

                        if (bonjour !== undefined && bonjour.name !== undefined && bonjour.name !== null && bonjour.name.length > 0 && bonjour.name.indexOf(':') == -1) {
                            _device.name = bonjour.name;
                        }

                        if (_device.name !== undefined) {
                            _device.name = _device.name
                                .replace(/.local/g, '')
                                .replace(/-/g, ' ');
                        }






                        if (result.nmap.type !== undefined && result.nmap.type !== null) {
                            if (_device.type === undefined || _device.type === null || result.nmap.type.length > _device.type.length) {
                                _device.type = result.nmap.type instanceof Array ? result.nmap.type[result.nmap.type.length - 1] : result.nmap.type;
                            }
                        }


                        if (result.nmap.os !== undefined && result.nmap.os !== null && result.nmap.os.length > 0) {
                            _device.os = result.nmap.os;
                        }



                        logger.debug("Discovered device: " + JSON.stringify(_device) + ' from result: ' + JSON.stringify(result));

                        if (_device.name !== undefined && _device.name !== null) {
                            _device.is_present = true;
                            _device.last_presence_date = new Date(macAddress.last_presence_date.replace(' ', 'T'));

                            if (device === undefined) {
                                return instance._add(_device)
                                    .then(function (row) {
                                        macAddress.device_id = row.id;
                                        return instance._updateMacAddressByAddress(macAddress.address, macAddress);
                                    });
                            } else {
                                _device.updated_date = new Date();
                                _device.is_synced = false;
                                return instance._updateById(_device.id, _device);
                            }


                        }
                    });
            }
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

device.prototype._generatePushID = (function () {
    // Modeled after base64 web-safe chars, but ordered by ASCII.
    var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

    // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
    var lastPushTime = 0;

    // We generate 72-bits of randomness which get turned into 12 characters and appended to the
    // timestamp to prevent collisions with other clients.  We store the last characters we
    // generated because in the event of a collision, we'll use those same characters except
    // "incremented" by one.
    var lastRandChars = [];

    return function () {
        var now = new Date().getTime();
        var duplicateTime = (now === lastPushTime);
        lastPushTime = now;

        var timeStampChars = new Array(8);
        for (var i = 7; i >= 0; i--) {
            timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
            // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
            now = Math.floor(now / 64);
        }
        if (now !== 0) throw new Error('We should have converted the entire timestamp.');

        var id = timeStampChars.join('');

        if (!duplicateTime) {
            for (i = 0; i < 12; i++) {
                lastRandChars[i] = Math.floor(Math.random() * 64);
            }
        } else {
            // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
            for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
                lastRandChars[i] = 0;
            }
            lastRandChars[i]++;
        }
        for (i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(lastRandChars[i]);
        }
        if (id.length != 20) throw new Error('Length should be 20.');

        return id;
    };
})();

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

        if (ip.indexOf('10.172.161.1') == 0) {
            return resolve(result);
        }

        var spawn = require('child_process').spawn,
            _process = spawn('nmap', [
                '-n',
                '--min-rate=2000',
                '-O',
                '-v',
                '--osscan-guess',
                '--max-os-tries=1',
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

device.prototype._isPresent = function (device) {
    return new Promise(function (resolve, reject) {

        function handleArpDiscover() {
            instance.communication.removeListener('monitor:arp:discover:finish', handleArpDiscover);

            return instance._findMacAddressesByDeviceId(device.id)
                .then(function (mac_addresses) {
                    if (mac_addresses !== undefined) {
                        var values = _.pluck(mac_addresses, 'address');

                        return instance.communication.emitAsync('database:monitor:retrieveAll',
                                'SELECT * FROM arp WHERE mac_address IN (' + values.map(function () {
                                    return '?';
                                }) + ');',
                            values)
                            .then(function (rows) {
                                resolve(rows !== undefined && rows !== null && rows.length > 0);
                            });
                    }
                })
                .catch(function (error) {
                    reject(error);
                });
        }

        instance.communication.on('monitor:arp:discover:finish', handleArpDiscover);
    });
};

device.prototype._onCreateOrUpdateDeviceIncomingSynchronization = function (device) {
    return instance.communication.emitAsync('database:person:retrieveAll', 'PRAGMA table_info(device)', [])
        .then(function (rows) {
            device = _.pick(device, _.pluck(rows, 'name'));

            return instance._findById(device.id)
                .then(function (row) {
                    if (row !== undefined) {

                        if (moment(device.updated_date).isAfter(row.updated_date)) {

                            if (row.employee_id !== null && device.employee_id === undefined) {
                                device.employee_id = null;
                            }

                            device = _.omit(device, 'is_present', 'last_presence_date');

                            return instance._updateById(device.id, device)
                                .then(function () {
                                    device = _.extend(device, {
                                        is_present: row.is_present,
                                        last_presence_date: row.last_presence_date
                                    });

                                    if (row.employee_id !== null && device.employee_id === null) {
                                        instance.communication.emit('person:device:removedFromEmployee', device, {id: row.employee_id});
                                    } else if (row.employee_id === null && device.employee_id !== null) {
                                        instance.communication.emit('person:device:addedToEmployee', device, {id: device.employee_id});
                                    }
                                });
                        }
                    } else {
                        return instance._add(device)
                            .then(function () {
                                if (device.is_present) {
                                    return instance._isPresent(device)
                                        .then(function (is_present) {

                                            if (!is_present) {
                                                device.updated_date = new Date();
                                                device.is_present = false;
                                                device.is_synced = false;

                                                return instance._updateById(device.id, device)
                                                    .then(function () {
                                                        instance.communication.emit('person:device:offline', device);
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
    return instance._findById(device.id)
        .then(function (row) {

            if (row !== undefined) {
                return instance._deleteById(device.id)
                    .then(function () {
                        if (row.is_present) {
                            row.is_to_be_deleted = true;

                            instance.communication.emit('person:device:offline', row);
                        }
                    });
            }
        })
        .catch(function (error) {
            logger.error(error.stack);
        });
};

device.prototype._onMacAddressOnline = function (mac_address) {
    instance.communication.emit('worker:job:enqueue', 'person:device:discover', mac_address, null, false);

    if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
        return instance._findById(mac_address.device_id)
            .then(function (device) {

                if (device !== undefined && !device.is_present) {
                    device.updated_date = new Date();
                    device.is_present = true;
                    device.last_presence_date = mac_address.last_presence_date;
                    device.is_synced = false;

                    return instance._updateById(device.id, device)
                        .then(function () {
                            instance.communication.emit('person:device:online', device);
                        });
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    }
};

device.prototype._onMacAddressOffline = function (mac_address) {
    if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
        return instance._findMacAddressesByDeviceId(mac_address.device_id)
            .then(function (mac_addresses) {

                if (mac_addresses !== undefined) {
                    mac_addresses = _.filter(mac_addresses, _.matches({'is_present': 1}));

                    if (mac_addresses !== undefined && mac_addresses.length == 0) {
                        return instance._findById(mac_address.device_id)
                            .then(function (device) {
                                device.updated_date = new Date();
                                device.is_present = false;
                                device.last_presence_date = mac_address.last_presence_date;
                                device.is_synced = false;

                                return instance._updateById(device.id, device).then(function () {
                                    instance.communication.emit('person:device:offline', device);
                                });
                            });
                    }
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    }
};

device.prototype._onDeviceOutgoingSynchronization = function (callback) {
    instance.communication.emit('database:person:retrieveOneByOne', 'SELECT * FROM device WHERE is_synced = 0', [], function (error, row) {
        if (error) {
            logger.error(error.stack);
        } else {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                row.is_present = row.is_present == 1;
                row.is_manual = row.is_manual == 1;

                instance._findMacAddressesByDeviceId(row.id)
                    .then(function (macAddresses) {
                        row.mac_addresses = {};

                        _.forEach(macAddresses, function (macAddress) {
                            row.mac_addresses[macAddress.id] = true;
                        });

                        callback(null, row, function (error) {
                            if (error) {
                                logger.error(error.stack)
                            } else {
                                delete row.mac_addresses;

                                row.is_synced = true;

                                instance._updateById(row.id, row)
                                    .catch(function (error) {
                                        logger.error(error.stack);
                                    });
                            }
                        });
                    });
            }
        }
    });
};

device.prototype._findMacAddressesByDeviceId = function (id) {
    return instance.communication.emitAsync('database:person:retrieveAll',
        "SELECT * FROM mac_address WHERE device_id = ?;", [id])
        .then(function (rows) {
            if (rows !== undefined) {
                _.forEach(rows, function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                });
            }

            return rows;
        });
};

device.prototype._findAllBonjoursByIpAddress = function (ipAddress) {
    return instance.communication.emitAsync('database:monitor:retrieveAll',
        "SELECT * FROM bonjour WHERE ip_address = ?;", [ipAddress])
        .then(function (rows) {
            if (rows !== undefined) {
                _.forEach(rows, function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                });
            }

            return rows;
        });
};

device.prototype._findAllUPnPsByIpAddress = function (ipAddress) {
    return instance.communication.emitAsync('database:monitor:retrieveAll',
        "SELECT * FROM upnp WHERE ip_address = ?;", [ipAddress])
        .then(function (rows) {
            if (rows !== undefined) {
                _.forEach(rows, function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                });
            }

            return rows;
        });
};

device.prototype._findIpAdressByMacAddress = function (macAddress) {
    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT ip_address FROM arp WHERE mac_address = ?;", [macAddress]);
};

device.prototype._findById = function (id) {
    return instance.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM device WHERE id = ?;", [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }
                row.is_present = row.is_present == 1;
                row.is_manual = row.is_manual == 1;
            }

            return row;
        });
};

device.prototype._findByMacAddress = function (macAddress) {
    return instance.communication.emitAsync('database:person:retrieveOne',
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
    var _device = _.clone(device);

    if (_device.id === undefined || _device.id === null) {
        _device.id = instance._generatePushID();
    }

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

    return instance.communication.emitAsync('database:person:create',
        'INSERT INTO device (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values).then(function () {
        return _device;
    });
};

device.prototype._updateById = function (id, device) {
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

    return instance.communication.emitAsync('database:person:update',
        'UPDATE device SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values);
};

device.prototype._deleteById = function (id) {
    return instance.communication.emitAsync('database:person:delete', 'DELETE FROM device WHERE id = ?;', [id]);
};

device.prototype._updateMacAddressByAddress = function (address, mac_address) {
    var _macAddress = _.clone(mac_address);

    if (_macAddress.created_date !== undefined && _macAddress.created_date !== null && _macAddress.created_date instanceof Date) {
        _macAddress.created_date = _macAddress.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_macAddress.updated_date !== undefined && _macAddress.updated_date !== null && _macAddress.updated_date instanceof Date) {
        _macAddress.updated_date = _macAddress.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_macAddress.last_presence_date !== undefined && _macAddress.last_presence_date !== null && _macAddress.last_presence_date instanceof Date) {
        _macAddress.last_presence_date = _macAddress.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_macAddress);
    var values = _.values(_macAddress);

    return instance.communication.emitAsync('database:person:update',
        'UPDATE mac_address SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE address = \'' + address + '\';',
        values);
};

var instance = new device();

module.exports = instance;
