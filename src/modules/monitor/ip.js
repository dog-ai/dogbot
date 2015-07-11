/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var os = require('os');

function ip() {
    var moduleManager = {};
    var timeout = undefined;
}

ip.prototype.type = "MONITOR";

ip.prototype.name = "ip";

ip.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

ip.prototype.load = function (moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    this.moduleManager.emit('database:monitor:setup',
        "CREATE TABLE IF NOT EXISTS ip (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "ip_address TEXT NOT NULL UNIQUE" +
        ");", [],
        function (error) {
            if (error !== null) {
                throw error;
            } else {
                self.start();
            }
        });
};

ip.prototype.unload = function () {
    this.stop();
};

ip.prototype.start = function () {
    var self = this;

    this.moduleManager.on('monitor:bonjour:create', function (bonjour) {
        self._addOrUpdate(bonjour.ip_address, function (error) {
            if (error !== null) {
                console.error(error.stack);
            }
        });
    });

    this.moduleManager.on('monitor:bonjour:update', function (bonjour) {
        self._addOrUpdate(bonjour.ip_address, function (error) {
            if (error !== null) {
                console.error(error.stack);
            }
        });
    });

    var time = 60 * 1000;

    function monitor() {
        try {
            self._discover(function () {
                self._clean();
            });
        } catch (error) {
            console.error(error.stack);
        }

        self.timeout = setTimeout(monitor, time * (1 + Math.random()));
    }

    monitor();
};

ip.prototype.stop = function () {
    clearTimeout(this.timeout);
};

ip.prototype._discover = function (callback) {
    var self = this;

    var networkInterfaces = os.networkInterfaces();
    _.forEach(networkInterfaces, function (addresses) {
        _.forEach(addresses, function (address) {
            if (address.family === 'IPv4' && !address.internal && address.mac !== '00:00:00:00:00:00') {
                var subnet = require('ip').subnet(address.address, address.netmask);

                if (subnet.subnetMaskLength < 20) {
                    return;
                }

                var process = require('child_process')
                    .spawn('fping', [
                        '-q',
                        '-c 1',
                        '-r 0',
                        '-i 10',
                        '-t 100',
                        '-g', subnet.networkAddress + '/' + subnet.subnetMaskLength
                    ]);

                process.stdout.setEncoding('utf8');

                process.stdout.pipe(require('split')()).on('data', function (line) {

                });

                process.stderr.pipe(require('split')()).on('data', function (line) {
                    if (line.indexOf('min/avg/max') === -1) {
                        return;
                    }

                    var values = line.split(' ');

                    var ipAddress = values[0];

                    self._addOrUpdate(ipAddress, function (error) {
                        if (error !== null) {
                            console.error(error.stack);
                        }
                    });
                });

                process.on('close', function () {
                    if (callback !== undefined) {
                        callback();
                    }
                });
            }
        });
    });
};

ip.prototype._clean = function () {
    var self = this;

    var currentDate = new Date();
    this._delete(new Date(new Date().setMinutes(currentDate.getMinutes() - 10)), function (error, ip) {
        if (error !== null) {
            console.error(error.stack);
        } else {
            self.moduleManager.emit('monitor:ipAddress:delete', ip.ip_address);
        }
    });
};

ip.prototype._addOrUpdate = function (ipAddress, callback) {
    var self = this;

    this.moduleManager.emit('database:monitor:retrieveOne',
        "SELECT * FROM ip WHERE ip_address = ?;", [ipAddress],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error)
                }
            } else {
                if (row === undefined) {
                    self._add(ipAddress, function (error) {
                        if (error === null) {
                            self.moduleManager.emit('monitor:ipAddress:create', ipAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {
                    self._update(ipAddress, function (error) {
                        if (error === null) {
                            self.moduleManager.emit('monitor:ipAddress:update', ipAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                }
            }
        });
};

ip.prototype._add = function (ipAddress, callback) {
    this.moduleManager.emit('database:monitor:create',
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

    this.moduleManager.emit('database:monitor:update',
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

ip.prototype._delete = function (oldestDate, callback) {
    var self = this;

    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM ip WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error.stack);
                }
            } else {
                if (row !== undefined) {
                    self.moduleManager.emit('database:monitor:delete',
                        "DELETE FROM ip WHERE id = ?;", [row.id],
                        function (error) {
                            if (callback !== undefined) {
                                callback(error, row);
                            }
                        });
                }
            }
        });
};

module.exports = new ip();
