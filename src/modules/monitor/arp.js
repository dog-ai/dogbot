/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function arp() {
    var moduleManager = {};
    var timeout = undefined;
}

arp.prototype.type = "MONITOR";

arp.prototype.name = "arp";

arp.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

arp.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.start();
};

arp.prototype.unload = function () {
    this.stop();
};

arp.prototype.start = function () {
    var self = this;

    this.moduleManager.on('monitor:ipAddress:create', function (ipAddress) {
        self._resolve(ipAddress, function (error, macAddress) {
            if (error !== null) {
                console.error(error.stack);
            } else {
                self._addOrUpdate(ipAddress, macAddress, function (error) {
                    if (error !== null) {
                        console.error(error.stack);
                    }
                });
            }
        })
    });

    this.moduleManager.on('monitor:ipAddress:update', function (ipAddress) {
        self._resolve(ipAddress, function (error, macAddress) {
            if (error !== null) {
                console.error(error.stack);
            } else {
                self._addOrUpdate(ipAddress, macAddress, function (error) {
                    if (error !== null) {
                        console.error(error.stack);
                    }
                });
            }
        })
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

arp.prototype.stop = function () {
    clearTimeout(this.timeout);
};

arp.prototype._discover = function (callback) {
    var self = this;

    var spawn = require('child_process').spawn,
        process = spawn('arp-scan', ['--interface=wlan0', '-lqNg', '-t 500', '-r 4']);

    process.stdout.setEncoding('utf8');
    process.stdout.pipe(require('split')()).on('data', function (line) {
        if (line.indexOf('\t') === -1) {
            return;
        }

        var values = line.split('\t');

        var ipAddress = values[0];
        var macAddress = values[1];

        self._addOrUpdate(ipAddress, macAddress, function (error) {
            if (error !== null) {
                console.error(error.stack);
            }
        });
    });

    process.stderr.on('data', function (data) {
        console.error(new Error(data));
    });

    process.on('close', function () {
        if (callback !== undefined) {
            callback();
        }
    });
};

arp.prototype._clean = function () {
    var self = this;

    var currentDate = new Date();
    this._delete(new Date(new Date().setMinutes(currentDate.getMinutes() - 10)), function (error, arp) {
        if (error !== null) {
            console.error(error.stack);
        } else {
            self.moduleManager.emit('monitor:macAddress:delete', arp.mac_address);
        }
    });
};

arp.prototype._resolve = function (ipAddress, callback) {
    var spawn = require('child_process').spawn,
        process = spawn('arp', ['-n', ipAddress]);

    process.stdout.setEncoding('utf8');
    process.stdout.pipe(require('split')()).on('data', function (line) {
        if (line !== null && line.length === 0 || line.lastIndexOf('A', 0) === 0) {
            return;
        }

        var values = line.replace(/\s\s+/g, ' ').split(' ');

        var macAddress = values[2];

        if (!/^(([a-f0-9]{2}:){5}[a-f0-9]{2},?)+$/i.test(macAddress)) {
            return;
        }

        callback(null, macAddress);
    });

    process.stderr.on('data', function (data) {
        //callback(new Error(data));
    });
};

arp.prototype._addOrUpdate = function (ipAddress, macAddress, callback) {
    var self = this;

    this.moduleManager.emit('database:monitor:retrieveOne',
        "SELECT * FROM arp WHERE ip_address = ?;", [ipAddress],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error)
                }
            } else {
                if (row === undefined) {
                    self._add(ipAddress, macAddress, function (error) {
                        if (error !== null) {
                            self.moduleManager.emit('monitor:macAddress:create', macAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {
                    self._update(ipAddress, macAddress, function (error) {
                        if (error === null) {
                            self.moduleManager.emit('monitor:macAddress:update', macAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                }
            }
        });
};

arp.prototype._add = function (ipAddress, macAddress, callback) {
    this.moduleManager.emit('database:monitor:create',
        "INSERT INTO arp (ip_address, mac_address) VALUES (?, ?);", [
            ipAddress,
            macAddress
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

arp.prototype._update = function (ipAddress, macAddress, callback) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update',
        "UPDATE arp SET updated_date = ?, mac_address = ? WHERE ip_address = ?;", [
            updatedDate,
            macAddress,
            ipAddress
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

arp.prototype._delete = function (oldestDate, callback) {
    var self = this;

    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM arp WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error.stack);
                }
            } else {
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM arp WHERE id = ?;", [row.id],
                    function (error) {
                        if (callback !== undefined) {
                            callback(error, row);
                        }
                    });
            }
        });
};

module.exports = new arp();
