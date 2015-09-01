/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function bonjour() {
    var moduleManager = {};
    var timeout = undefined;
}

bonjour.prototype.type = "MONITOR";

bonjour.prototype.name = "bonjour";

bonjour.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

bonjour.prototype.load = function (moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.start();
};

bonjour.prototype.unload = function () {
    this.stop();
};

bonjour.prototype.start = function () {
    var self = this;

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

bonjour.prototype.stop = function () {
    clearTimeout(this.timeout);
};

bonjour.prototype._discover = function (callback) {
    var self = this;

    var spawn = require('child_process').spawn,
        process = spawn('avahi-browse', ['-alrpc']);

    process.stdout.setEncoding('utf8');
    process.stdout.pipe(require('split')()).on('data', function (line) {
        if (line.charAt(0) !== '=') {
            return;
        }

        var values = line.split(';');

        var name = values[3];
        var type = values[4];
        var hostname = values[6];
        var address = values[7];
        var port = values[8];
        var txt = values[9];

        if (type.charAt(0) === '_') {
            return;
        }

        self._addOrUpdate(type, name, address, hostname, port, txt, function (error) {
            if (error !== null) {
                console.error(error.stack);
            }
        });
    });

    process.stderr.on('data', function (data) {
        //console.error(new Error(data));
    });

    process.on('close', function () {
        if (callback !== undefined) {
            callback();
        }
    });
};

bonjour.prototype._clean = function () {
    var self = this;

    var currentDate = new Date();
    this._deleteAllBeforeDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)), function (error, bonjour) {
        if (error !== null) {
            console.error(error.stack);
        } else {
            self.moduleManager.emit('monitor:bonjour:delete', bonjour.ip_address);
        }
    });
};

bonjour.prototype._addOrUpdate = function (type, name, address, hostname, port, txt, callback) {
    var self = this;

    this.moduleManager.emit('database:monitor:retrieveOne',
        "SELECT * FROM bonjour WHERE type = ? AND name = ?;", [type, name],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error)
                }
            } else {
                if (row === undefined) {
                    self._addPresence(type, name, address, hostname, port, txt, function (error) {
                        if (error === null) {
                            self.moduleManager.emit('monitor:bonjour:create', {
                                type: type,
                                name: name,
                                hostname: hostname,
                                ip_address: address,
                                port: port,
                                txt: txt
                            });
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                } else {
                    self._update(type, name, address, hostname, port, txt, function (error) {
                        if (error === null) {
                            self.moduleManager.emit('monitor:bonjour:update', {
                                type: type,
                                name: name,
                                hostname: hostname,
                                ip_address: address,
                                port: port,
                                txt: txt
                            });
                        }

                        if (callback !== undefined) {
                            callback(error)
                        }
                    });
                }
            }
        });
};

bonjour.prototype._addPresence = function (type, name, address, hostname, port, txt, callback) {
    this.moduleManager.emit('database:monitor:create',
        "INSERT INTO bonjour (type, name, ip_address, hostname, port, txt) VALUES (?, ?, ?, ?, ?, ?);",
        [
            type,
            name,
            address,
            hostname,
            port,
            txt
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });

};

bonjour.prototype._update = function (type, name, address, hostname, port, txt, callback) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update',
        "UPDATE bonjour SET updated_date = ?, ip_address = ?, hostname = ?, port = ?, txt = ? WHERE type = ? AND name = ?;", [
            updatedDate,
            address,
            hostname,
            port,
            txt,
            type,
            name
        ],
        function (error) {
            if (callback !== undefined) {
                callback(error);
            }
        });
};

bonjour.prototype._deleteAllBeforeDate = function (oldestDate, callback) {
    var self = this;

    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM bonjour WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, row) {
            if (error !== null) {
                if (callback !== undefined) {
                    callback(error);
                }
            } else {
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM bonjour WHERE id = ?;", [row.id],
                    function (error) {
                        if (callback !== undefined) {
                            callback(error, row);
                        }
                    });
            }
        });
};

module.exports = new bonjour();
