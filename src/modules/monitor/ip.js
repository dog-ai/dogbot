/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    Promise = require('bluebird'),
    os = require('os');

function ip() {
}

ip.prototype.type = "MONITOR";

ip.prototype.name = "ip";

ip.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

ip.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

ip.prototype.unload = function () {
    this.stop();
};

ip.prototype.start = function () {
    this.communication.on('monitor:ip:discover', this._discover);
    this.communication.on('monitor:bonjour:create', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.on('monitor:bonjour:update', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.on('monitor:upnp:create', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.on('monitor:upnp:update', this._onServiceDiscoveryCreateOrUpdate);

    this.communication.emit('worker:job:enqueue', 'monitor:ip:discover', null, '1 minute');
};

ip.prototype.stop = function () {
    this.communication.removeListener('monitor:ip:discover', this._discover);
    this.communication.removeListener('monitor:bonjour:create', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.removeListener('monitor:bonjour:update', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.removeListener('monitor:upnp:create', this._onServiceDiscoveryCreateOrUpdate);
    this.communication.removeListener('monitor:upnp:update', this._onServiceDiscoveryCreateOrUpdate);
};


ip.prototype._discover = function (params, callback) {
    return instance._execFping()
        .then(function (ips) {
            return Promise.each(ips, function (ip) {
                    return instance._createOrUpdate(ip);
                })
                .then(function () {
                    return instance._clean();
                });
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

ip.prototype._onServiceDiscoveryCreateOrUpdate = function (service, callback) {
    var date = new Date(new Date().setSeconds(new Date().getSeconds() - 10));
    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT * FROM ip WHERE ip_address = ? AND updated_date > Datetime(?);", [service.ip_address, updatedDate])
        .then(function (row) {
            if (row === undefined) {
                var ip = {
                    ip_address: service.ip_address
                };

                return instance._createOrUpdate(ip);
            }
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

ip.prototype._execFping = function () {
    return new Promise(function (resolve, reject) {
        var ips = [];

        var networkInterfaces = os.networkInterfaces();
        var addresses = networkInterfaces['wlan0'] || networkInterfaces['en0'];

        if (addresses === undefined || addresses === null) {
            reject(new Error());
        }

        var address = _.find(addresses, {family: 'IPv4', internal: false});

        if (address === undefined) {
            reject(new Error());
        }

        var subnet = require('ip').subnet(address.address, address.netmask);

        var process = require('child_process')
            .spawn('fping', [
                '-a',
                '-r 0',
                '-i 10',
                '-t 100',
                '-g', subnet.networkAddress + '/' + subnet.subnetMaskLength
            ]);

        process.stdout.setEncoding('utf8');

        process.stdout.pipe(require('split')()).on('data', function (line) {
            if (!/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(line)) {
                return;
            }

            if (line.indexOf(address.address) == 0) {
                return;
            }

            var ip = {
                ip_address: line
            };

            ips.push(ip);
        });

        process.stderr.pipe(require('split')()).on('data', function (line) {
            if (line === undefined ||
                line.length === 0 ||
                line.indexOf('ICMP Host') === 0 ||
                line.indexOf('duplicate') != -1) {
                return;
            }

            reject(new Error(line));
        });

        process.on('error', function (error) {
            reject(error)
        });

        process.on('exit', function () {
            resolve(ips);
        });
    });
};

ip.prototype._clean = function () {
    var now = new Date();
    return instance._deleteAllBeforeDate(new Date(now.setMinutes(now.getMinutes() - 10)),
        function (ip) {
            instance.communication.emit('monitor:ipAddress:delete', ip.ip_address);
        });
};


ip.prototype._createOrUpdate = function (ip) {
    return instance._findByIpAddress(ip.ip_address)
        .then(function (row) {
            if (row === undefined) {
                return instance._create(ip)
                    .then(function () {
                        return instance.communication.emitAsync('monitor:ip:create', ip);
                    });
            } else {
                ip.updated_date = new Date();
                instance._updateByIpAddress(ip.ip_address, ip)
                    .then(function () {
                        return instance.communication.emitAsync('monitor:ip:update', ip);
                    });
            }
        });
};

ip.prototype._create = function (ip) {
    var _ip = _.clone(ip);

    if (_ip.created_date !== undefined && _ip.created_date !== null && _ip.created_date instanceof Date) {
        _ip.created_date = _ip.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_ip.updated_date !== undefined && _ip.updated_date !== null && _ip.updated_date instanceof Date) {
        _ip.updated_date = _ip.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_ip);
    var values = _.values(_ip);

    return instance.communication.emitAsync('database:monitor:create',
        'INSERT INTO ip (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values).then(function () {
        return _ip;
    });
};

ip.prototype._updateByIpAddress = function (ipAddress, ip) {
    var _ip = _.clone(ip);

    if (_ip.created_date !== undefined && _ip.created_date !== null && _ip.created_date instanceof Date) {
        _ip.created_date = _ip.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_ip.updated_date !== undefined && _ip.updated_date !== null && _ip.updated_date instanceof Date) {
        _ip.updated_date = _ip.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_ip);
    var values = _.values(_ip);

    return instance.communication.emitAsync('database:monitor:update',
        'UPDATE ip SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE ip_address = \'' + ipAddress + '\';',
        values);
};

ip.prototype._findByIpAddress = function (ipAddress) {
    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT * FROM ip WHERE ip_address = ?;", [ipAddress])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
            }
            return row;
        });
};

ip.prototype._deleteAllBeforeDate = function (oldestDate, callback) {
    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return instance.communication.emitAsync('database:monitor:retrieveAll',
        "SELECT * FROM ip WHERE updated_date < Datetime(?);", [updatedDate])
        .then(function (rows) {
            return Promise.each(rows, function (row) {
                return instance.communication.emitAsync('database:monitor:delete', "DELETE FROM bonjour WHERE id = ?;", [row.id])
                    .then(function () {
                        return callback(row);
                    });
            });
        });
};


var instance = new ip();

module.exports = instance;
