/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

function arp() {
}

arp.prototype.type = "MONITOR";

arp.prototype.name = "arp";

arp.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

arp.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

arp.prototype.unload = function () {
    this.stop();
};

arp.prototype.start = function () {
    this.communication.on('monitor:arp:discover', this.discover);
    this.communication.on('monitor:arp:resolve', this.resolve);

    this.communication.on('monitor:ip:create', this.onIpCreateOrUpdate);
    this.communication.on('monitor:ip:update', this.onIpCreateOrUpdate);


    this.communication.emit('worker:job:enqueue', 'monitor:arp:discover', null, '1 minute');
};

arp.prototype.stop = function () {
    this.communication.removeListener('monitor:arp:discover', this.discover);
    this.communication.removeListener('monitor:arp:resolve', this.resolve);

    this.communication.removeListener('monitor:ip:create', this.onIpCreateOrUpdate);
    this.communication.removeListener('monitor:ip:update', this.onIpCreateOrUpdate);

};


arp.prototype.discover = function (params, callback) {
    try {
        instance.communication.emit('monitor:arp:discover:begin');

        instance._execArpScan(function () {
            instance._clean(function () {
                instance.communication.emit('monitor:arp:discover:finish');

                if (callback !== undefined) {
                    callback();
                }
            });
        });
    } catch (error) {
        if (callback !== undefined) {
            callback(error);
        }
    }
};

arp.prototype.resolve = function (ip, callback) {
    instance._execArp(ip, function (error, macAddress) {
        if (error) {
            callback(error);
        } else {
            if (macAddress !== null) {
                instance._addOrUpdate(ip, macAddress, function (error) {
                    if (error) {
                        callback(error);
                    } else {
                        callback();
                    }
                });
            } else {
                callback();
            }
        }
    })
};

arp.prototype.onIpCreateOrUpdate = function (ip) {
    instance.communication.emit('worker:job:enqueue', 'monitor:arp:resolve', ip);
};


arp.prototype._execArpScan = function (callback) {
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
        });
    });

    _process.stderr.on('data', function (data) {
        if (callback !== undefined) {
            callback(new Error(data));
        }
    });

    _process.on('close', function () {
        if (callback !== undefined) {
            callback();
        }
    });
};

arp.prototype._execArp = function (ipAddress, callback) {
    var spawn = require('child_process').spawn,
        _process = spawn('arp', ['-n', ipAddress]);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
        if (line !== null && line.length === 0 || line.lastIndexOf('A', 0) === 0) {
            callback(null, null);
        } else {
            var values = line.replace(/\s\s+/g, ' ').split(' ');

            var macAddress;
            if (process.platform === 'linux') {
                macAddress = values[2];
            } else {
                macAddress = values[3];

                if (macAddress.indexOf(':') > -1) { // We need to fix malformed MAC addresses coming from OSX arp binary
                    values = macAddress.split(':');
                    macAddress = '';
                    for (var i = 0; i < values.length; i++) {
                        if (values[i].length == 1) {
                            values[i] = '0' + values[i];
                        }

                        if (macAddress !== '') {
                            macAddress += ':';
                        }

                        macAddress += values[i];
                    }
                }
            }

            if (!/^(([a-f0-9]{2}:){5}[a-f0-9]{2},?)+$/i.test(macAddress)) {
                macAddress = null;
            }

            callback(null, macAddress);
        }
    });

    _process.stderr.on('data', function (data) {
        callback(new Error(data));
    });
};

arp.prototype._clean = function (callback) {
    var self = this;

    var currentDate = new Date();
    this._deleteAllBeforeDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)), function (error) {
        if (callback !== undefined) {
            callback(error);
        }
    }, function (arp) {
        self.communication.emit('monitor:arp:delete', arp.mac_address);
    });
};







arp.prototype._addOrUpdate = function (ipAddress, macAddress, callback) {
    var self = this;

    this.communication.emit('database:monitor:retrieveOne',
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
                            self.communication.emit('monitor:arp:create', macAddress);
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {

                    self._update(ipAddress, macAddress, function (error) {
                        if (!error) {
                            self.communication.emit('monitor:arp:update', macAddress);
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
    this.communication.emit('database:monitor:create',
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

    this.communication.emit('database:monitor:update',
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

    this.communication.emit('database:monitor:retrieveAll',
        "SELECT * FROM arp WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, rows) {
            if (!error) {
                if (rows !== undefined) {

                    rows.forEach(function (row) {
                        self.communication.emit('database:monitor:delete',
                            "DELETE FROM arp WHERE id = ?;", [row.id],
                            function (error) {
                                if (error) {
                                    logger.error(error.stack);
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
