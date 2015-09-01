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

    this.start();
};

arp.prototype.unload = function () {
    this.stop();
};

arp.prototype.start = function () {
    var self = this;

    this.moduleManager.on('monitor:ipAddress:create', this._handleIpAddress);
    this.moduleManager.on('monitor:ipAddress:update', this._handleIpAddress);

    var time = 60 * 1000;
    function monitor() {
        try {
            self.moduleManager.emit('monitor:arp:discover:begin');

            self._discover(function () {
                self._clean(function () {

                    self.moduleManager.emit('monitor:arp:discover:finish');
                });
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

    this.moduleManager.removeListener('monitor:ipAddress:create', this._handleIpAddress);
    this.moduleManager.removeListener('monitor:ipAddress:create', this._handleIpAddress);
};

arp.prototype._handleIpAddress = function (ipAddress) {
    instance._resolve(ipAddress, function (error, macAddress) {
        if (error) {
            console.error(error.stack);
        } else {
            instance._addOrUpdate(ipAddress, macAddress, function (error) {
                if (error) {
                    console.error(error.stack);
                }
            });
        }
    })
};

arp.prototype._discover = function (callback) {
    var self = this;

    var _interface = process.platform === 'linux' ? "wlan0" : "en0";

    var spawn = require('child_process').spawn;
    var _process = spawn('arp-scan', ['--interface=' + _interface, '-lqNg', '-t 500', '-r 4']);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
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

    _process.stderr.on('data', function (data) {
        console.error(new Error(data));
    });

    _process.on('close', function () {
        if (callback !== undefined) {
            callback();
        }
    });
};

arp.prototype._clean = function (callback) {
    var self = this;

    var currentDate = new Date();
    this._deleteAllBeforeDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)), function (error) {
        if (error) {
            console.error(error);
        }

        if (callback !== undefined) {
            callback();
        }
    }, function (arp) {
        self.moduleManager.emit('monitor:arp:delete', arp.mac_address);
    });
};

arp.prototype._resolve = function (ipAddress, callback) {
    var spawn = require('child_process').spawn,
        _process = spawn('arp', ['-n', ipAddress]);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
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

    _process.stderr.on('data', function (data) {
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

                    self._addPresence(ipAddress, macAddress, function (error) {
                        if (!error) {
                            self.moduleManager.emit('monitor:arp:create', macAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {

                    self._update(ipAddress, macAddress, function (error) {
                        if (!error) {
                            self.moduleManager.emit('monitor:arp:update', macAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                }
            }
        });
};

arp.prototype._addPresence = function (ipAddress, macAddress, callback) {
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

arp.prototype._deleteAllBeforeDate = function (date, callback, onDelete) {
    var self = this;

    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveAll',
        "SELECT * FROM arp WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, rows) {
            if (!error) {
                if (rows !== undefined) {

                    rows.forEach(function (row) {
                        self.moduleManager.emit('database:monitor:delete',
                            "DELETE FROM arp WHERE id = ?;", [row.id],
                            function (error) {
                                if (error) {
                                    console.error(error);
                                } else {
                                    if (onDelete !== undefined) {
                                        onDelete(row);
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

var instance = new arp();

module.exports = instance;
