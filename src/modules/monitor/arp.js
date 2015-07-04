/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function arp() {
    var moduleManager = {};
    var discoverInterval = undefined;
    var cleanInterval = undefined;
}

arp.prototype.type = "MONITOR";

arp.prototype.name = "arp";

arp.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
}

arp.prototype.load = function (moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.moduleManager.emit('database:monitor:setup',
        "CREATE TABLE IF NOT EXISTS arp (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "ip_address TEXT NOT NULL UNIQUE, " +
        "mac_address TEXT NOT NULL" +
        ");", [],
        function (error) {
            if (error !== undefined && error !== null) {
                throw new Error(error);
            } else {
                self.start();
            }
        });
}

arp.prototype.unload = function () {
    this.stop();
}

arp.prototype.start = function () {
    var self = this;

    this.discoverInterval = setInterval(function () {
        try {
            self._discover();
        } catch (error) {
            console.error(error);
        }
    }, 60 * 1000);

    this.cleanInterval = setInterval(function () {
        try {
            self._clean();
        } catch (error) {
            console.error(error);
        }
    }, 2 * 60 * 1000);
}

arp.prototype.stop = function () {
    clearInterval(this.discoverInterval);
    clearInterval(this.cleanInterval);
}

arp.prototype._discover = function () {
    //console.log("Discovering ARP entries");

    var self = this;

    var spawn = require('child_process').spawn,
        process = spawn('arp-scan', ['--interface=wlan0', '-lqN']);

    process.stdout.setEncoding('utf8');
    process.stdout.pipe(require('split')()).on('data', function (line) {
        if (line.indexOf('\t') === -1) {
            return;
        }

        var values = line.split('\t');

        var ipAddress = values[0];
        var macAddress = values[1];

        self.moduleManager.emit('database:monitor:retrieve',
            "SELECT * FROM arp WHERE ip_address = ?;", [ipAddress],
            function (error, row) {
                if (error !== null) {
                    console.error(error);
                } else {
                    if (row === undefined) {
                        //console.log("Adding ARP entry: " + ipAddress + " at " + macAddress);
                        self._add(ipAddress, macAddress);
                    } else {
                        //console.log("Updating ARP entry: " + ipAddress + " at " + macAddress);
                        self._update(ipAddress, macAddress);
                    }
                }
            });
    });

    process.stderr.on('data', function (data) {
    });
}

arp.prototype._clean = function () {
    //console.log("Cleaning old ARP entries");

    var currentDate = new Date();
    this._delete(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)));
}

arp.prototype._add = function (ipAddress, macAddress) {
    var self = this;

    this.moduleManager.emit('database:monitor:create',
        "INSERT INTO arp (ip_address, mac_address) VALUES (?, ?);", [
            ipAddress,
            macAddress
        ],
        function (error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('monitor:macAddress:create', address);
            }
        });
}

arp.prototype._update = function (ipAddress, macAddress) {
    var self = this;

    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update',
        "UPDATE arp SET updated_date = ?, mac_address = ? WHERE ip_address = ?;", [
            updatedDate,
            macAddress,
            ipAddress
        ],
        function (error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('monitor:macAddress:update', address);
            }
        });
}

arp.prototype._delete = function (oldestDate) {
    var self = this;

    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveAll',
        "SELECT * FROM arp WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, row) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM arp WHERE id = ?;", [row.id],
                    function (error) {
                        if (error !== undefined && error !== null) {
                            console.error(error);
                        } else {
                            self.moduleManager.emit('monitor:macAddress:delete', row.mac_address);
                        }
                    });
            }
        });
}

module.exports = new arp();
