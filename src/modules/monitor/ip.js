/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
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
    this.communication.on('monitor:ip:discover', this.discover);
    this.communication.on('monitor:bonjour:create', this.onBonjourCreateOrUpdate);
    this.communication.on('monitor:bonjour:update', this.onBonjourCreateOrUpdate);

    this.communication.emit('worker:job:enqueue', 'monitor:ip:discover', null, '1 minute');
};

ip.prototype.stop = function () {
    this.communication.removeListener('monitor:ip:discover', this.discover);

    this.communication.removeListener('monitor:bonjour:create', this.onBonjourCreate);
};


ip.prototype.discover = function (params, callback) {
    try {
        instance._execFping(function () {
            instance._clean(function () {
                if (callback !== undefined) {
                    callback();
                }
            });
        });
    } catch (error) {
        logger.error(error.stack);

        if (callback !== undefined) {
            callback(error);
        }
    }
};

ip.prototype.onBonjourCreateOrUpdate = function (bonjour) {
    var date = new Date(new Date().setSeconds(new Date().getSeconds() - 10));
    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT * FROM ip WHERE ip_address = ? AND updated_date < Datetime(?);", [ipAddress, updatedDate])
        .then(function (row) {
            if (row === undefined) {
                instance._addOrUpdate(bonjour.ip_address, function (error) {
                    if (error) {
                        logger.error(error.stack);
                    }
                });
            }
        });
};


ip.prototype._execFping = function (callback) {
    var self = this;

    var networkInterfaces = os.networkInterfaces();
    _.forEach(networkInterfaces, function (addresses, networkInterface) {
        if (networkInterface === 'en0' || networkInterface === 'wlan0') {
            _.forEach(addresses, function (address) {
                if (address.family === 'IPv4' && !address.internal && address.mac !== '00:00:00:00:00:00') {
                    var subnet = require('ip').subnet(address.address, address.netmask);

                    if (subnet.subnetMaskLength < 20) {
                        return;
                    }

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

                        self._addOrUpdate(line, function (error) {
                            if (error !== null) {
                                logger.error(error.stack);
                            }
                        });
                    });

                    process.stderr.pipe(require('split')()).on('data', function (line) {
                        if (line === undefined || line.length === 0 || line.indexOf('ICMP Host') === 0) {
                            return;
                        }

                        if (callback !== undefined) {
                            callback(new Error(line));
                        }
                    });

                    process.on('error', function (error) {
                        if (callback !== undefined) {
                            callback(new Error(error));
                        }
                    });

                    process.on('exit', function () {
                        if (callback !== undefined) {
                            callback();
                        }
                    });
                }
            });
        } else {
            callback();
        }
    });
};

ip.prototype._clean = function (callback) {
    var self = this;

    var currentDate = new Date();
    this._deleteAllBeforeDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 10)), function (error) {
            if (error) {
                logger.error(error.stack);
            }

            if (callback !== undefined) {
                callback();
            }
        },
        function (error, ip) {
            if (error) {
                logger.error(error.stack);
            } else {
                self.communication.emit('monitor:ipAddress:delete', ip.ip_address);
            }
        });
};


ip.prototype._addOrUpdate = function (ipAddress, callback) {
    var self = this;

    this.communication.emit('database:monitor:retrieveOne',
        "SELECT * FROM ip WHERE ip_address = ?;", [ipAddress],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error)
                }
            } else {
                if (row === undefined) {
                    self._addPresence(ipAddress, function (error) {
                        if (error === null) {
                            self.communication.emit('monitor:ip:create', ipAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {
                    self._update(ipAddress, function (error) {
                        if (error === null) {
                            self.communication.emit('monitor:ip:update', ipAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                }
            }
        });
};

ip.prototype._addPresence = function (ipAddress, callback) {
    this.communication.emit('database:monitor:create',
        "INSERT INTO ip (ip_address) VALUES (?);", [
            ipAddress
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

ip.prototype._update = function (ipAddress, callback) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.communication.emit('database:monitor:update',
        "UPDATE ip SET updated_date = ? WHERE ip_address = ?;", [
            updatedDate,
            ipAddress
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

ip.prototype._deleteAllBeforeDate = function (date, callback, onDelete) {
    var self = this;

    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.communication.emit('database:monitor:retrieveAll',
        "SELECT * FROM ip WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, rows) {
            if (!error) {
                if (rows !== undefined) {

                    rows.forEach(function (row) {
                        self.communication.emit('database:monitor:delete',
                            "DELETE FROM ip WHERE id = ?;", [row.id],
                            function (error) {
                                if (error) {
                                    logger.error(error.stack);
                                } else {
                                    if (onDelete !== undefined) {
                                        onDelete(null, row);
                                    }
                                }
                            });
                    });
                }

                if (callback !== undefined) {
                    callback(error);
                }
            }
        });
};


var instance = new ip();

module.exports = instance;
