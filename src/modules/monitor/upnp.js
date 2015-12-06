/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    Promise = require('bluebird');

function upnp() {
}

upnp.prototype.type = "MONITOR";

upnp.prototype.name = "upnp";

upnp.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

upnp.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

upnp.prototype.unload = function () {
    this.stop();
};

upnp.prototype.start = function () {
    this.communication.on('monitor:upnp:discover', this._discover);

    this.communication.emit('worker:job:enqueue', 'monitor:upnp:discover', null, '1 minute');
};

upnp.prototype.stop = function () {
    this.communication.removeListener('monitor:upnp:discover', this._discover);
};

upnp.prototype._discover = function (params, callback) {
    return instance._execMiniSSDPd()
        .then(function (upnps) {
            var urls = _.chain(upnps)
                .pluck('location')
                .uniq()
                .map(function (location) {
                    return require('url').parse(location);
                })
                .uniq(function (url) {
                    return url.hostname;
                })
                .value();

            return Promise.each(urls, function (url) {
                    return instance._readUPnPDescription(url).then(function (description) {
                        var upnp = {
                            location: url.href,
                            ip_address: url.hostname,
                            device_friendly_name: description.root.device[0].friendlyName[0],
                            device_manufacturer: description.root.device[0].manufacturer !== undefined ? description.root.device[0].manufacturer[0] : undefined,
                            device_model_name: description.root.device[0].modelName !== undefined ? description.root.device[0].modelName[0] : undefined,
                            device_model_description: description.root.device[0].modelDescription !== undefined ? description.root.device[0].modelDescription[0] : undefined
                        };

                        return instance._createOrUpdate(upnp);
                    });
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

upnp.prototype._readUPnPDescription = function (url) {
    return new Promise(function (resolve, reject) {
        require('http').get(url, function (res) {
            var xml = '';

            res.on('data', function (data) {
                xml += data;
            });

            res.on('error', function (data) {
                reject(new Error(data));
            });

            res.on('timeout', function (data) {
                reject(new Error(data));
            });

            res.on('end', function () {
                require('xml2js').parseString(xml, function (error, json) {
                    resolve(json);
                });
            });
        });
    });
};

upnp.prototype._execMiniSSDPd = function () {
    return new Promise(function (resolve, reject) {
        var timeout, ssdps = [];

        var socket = require('net').createConnection("/var/run/minissdpd.sock");

        socket.on("connect", function () {
            var buffer = new Buffer([0x03, 0x00, 0x00]);
            socket.write(buffer);

            timeout = setTimeout(function () {
                socket.destroy();
            }, 100);
        });

        socket.on("data", function (data) {
            clearTimeout(timeout);

            var strings = [];
            for (var pos = 1; pos < data.length; pos = end) {
                var start = pos + 1;
                var length = data[pos];
                var end = start + length;

                strings.push(data.toString('utf8', start, end));
            }

            ssdps = ssdps.concat((_.chain(strings).chunk(3).map(function (strings) {
                return {
                    location: strings[0],
                    type: strings[1],
                    usn: strings[2]
                };
            }).value()));

            socket.destroy();
        });

        socket.on("error", function (data) {
            reject(new Error(data));
        });
        socket.on("timeout", function (data) {
            reject(new Error(data));
        });

        socket.on("close", function () {
            resolve(ssdps);
        });
    })
};

upnp.prototype._clean = function () {
    var now = new Date();
    return instance._deleteAllBeforeDate(new Date(now.setMinutes(now.getMinutes() - 10)),
        function (upnp) {
            return instance.communication.emitAsync('monitor:upnp:delete', upnp.ip_address);
        });
};

upnp.prototype._createOrUpdate = function (upnp) {
    return instance._findByIpAddress(upnp.ip_address)
        .then(function (row) {
            if (row === undefined) {
                return instance._create(upnp)
                    .then(function () {
                        return instance.communication.emitAsync('monitor:upnp:create', upnp);
                    });
            } else {
                upnp.updated_date = new Date();
                return instance._updateIpAddress(upnp.ip_address, upnp)
                    .then(function () {
                        return instance.communication.emitAsync('monitor:upnp:update', upnp);
                    });
            }
        });
};

upnp.prototype._create = function (upnp) {
    var _upnp = _.clone(upnp);

    if (_upnp.created_date !== undefined && _upnp.created_date !== null && _upnp.created_date instanceof Date) {
        _upnp.created_date = _upnp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_upnp.updated_date !== undefined && _upnp.updated_date !== null && _upnp.updated_date instanceof Date) {
        _upnp.updated_date = _upnp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_upnp);
    var values = _.values(_upnp);

    return instance.communication.emitAsync('database:monitor:create',
        'INSERT INTO upnp (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values).then(function () {
        return _upnp;
    });
};

upnp.prototype._findByIpAddress = function (ipAddress) {
    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT * FROM upnp WHERE ip_address = ?;", [ipAddress])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
            }
            return row;
        });
};

upnp.prototype._updateIpAddress = function (ipAddress, upnp) {
    var _upnp = _.clone(upnp);

    if (_upnp.created_date !== undefined && _upnp.created_date !== null && _upnp.created_date instanceof Date) {
        _upnp.created_date = _upnp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_upnp.updated_date !== undefined && _upnp.updated_date !== null && _upnp.updated_date instanceof Date) {
        _upnp.updated_date = _upnp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_upnp);
    var values = _.values(_upnp);

    return instance.communication.emitAsync('database:monitor:update',
        'UPDATE upnp SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE ip_address = \'' + ipAddress + '\';',
        values);
};

upnp.prototype._deleteAllBeforeDate = function (oldestDate, callback) {
    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return instance.communication.emitAsync('database:monitor:retrieveAll',
        "SELECT * FROM upnp WHERE updated_date < Datetime(?);", [updatedDate])
        .then(function (rows) {
            return Promise.each(rows, function (row) {
                return instance.communication.emitAsync('database:monitor:delete', "DELETE FROM upnp WHERE id = ?;", [row.id])
                    .then(function () {
                        return callback();
                    });
            });
        });
};

var instance = new upnp();

module.exports = instance;
