/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlCreateTable = "CREATE TABLE IF NOT EXISTS arp (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "ip_address TEXT NOT NULL, " +
    "mac_address TEXT NOT NULL" +
    ");"

var sqlInsertEntryIntoTable = "INSERT INTO arp (ip_address, mac_address) VALUES (?, ?);";

var sqlUpdateTableEntryByIpAddress = "UPDATE arp SET updated_date = ?, mac_address = ? WHERE ip_address = ? ;";

var sqlSelectFromTableByIpAddress = "SELECT * FROM arp WHERE ip_address = ?;";

var sqlDeleteFromTableOldEntries = "DELETE FROM arp WHERE updated_date < Datetime(?)";

function arp() {
    var moduleManager = {};
    var cleanInterval = undefined;
    var listener = undefined;
}

arp.prototype.type = "MONITOR";

arp.prototype.name = "arp";

arp.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
}

arp.prototype.load = function(moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    this.moduleManager.emit('database:monitor:setup', sqlCreateTable, [], function(error) {
        if (error !== undefined && error !== null) {
            throw new Error(error);
        } else {
            self.start();
        }
    });
}

arp.prototype.unload = function() {
    this.stop();
}

arp.prototype.start = function() {
    var self = this;

    this.moduleManager.on('database:monitor:create', this.listener);
    this.moduleManager.on('database:monitor:update', this.listener);

    this.cleanInterval = setInterval(function() {
        try {
            self._clean();
        } catch (error) {
            console.error(error);
        }
    }, 2 * 60 * 1000);
}

arp.prototype.stop = function() {
    this.moduleManager.removeListener('database:monitor:create', this.listener);
    this.moduleManager.removeListener('database:monitor:update', this.listener);

    clearInterval(this.cleanInterval);
}

arp.prototype._listen = function(query, parameters, callback) {
    var self = this;

    if (parameters !== undefined) {
        parameters.forEach(function(parameter) {
            if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(parameter)) {
                var ipAddress = parameter;
                self._resolve(parameter, function(error, macAddress) {
                    if (error !== undefined && error !== null) {
                        console.error(error);
                    } else if (macAddress !== null) {

                        self.moduleManager.emit('database:monitor:retrieve', sqlSelectFromTableByIpAddress, [ipAddress],
                            function(error, row) {
                                if (error !== null) {
                                    console.error(error);
                                } else {
                                    if (row === undefined) {
                                        console.log("Adding ARP entry: " + ipAddress + " at " + macAddress);
                                        self._add(ipAddress, macAddress);
                                    } else {
                                        console.log("Updating ARP entry: " + ipAddress + " at " + macAddress);
                                        self._update(ipAddress, macAddress);
                                    }
                                }
                            });
                    }
                });
            }
        });
    }
}

arp.prototype._clean = function() {
    console.log("Cleaning old ARP entries");

    var currentDate = new Date();
    this._delete(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)));
}

arp.prototype._resolve = function(ip, callback) {
    require('child_process')
        .exec('ping -c 1 ' + ip + ' | arp -an ' + ip,
            function(error, stdout, stderr) {
                if (error !== undefined && error !== null) {
                    callback(error);
                } else {
                    if (callback !== undefined) {
                        var values = stdout.split(' ');
                        var mac = values[3];

                        if (!/^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/.test(mac)) {
                            mac = null;
                        }

                        callback(null, mac);
                    }
                }
            });
}

arp.prototype._add = function(ipAddress, macAddress) {
    this.moduleManager.emit('database:monitor:create', sqlInsertEntryIntoTable, [
            ipAddress,
            macAddress
        ],
        function(error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {

            }
        }, true);
}

arp.prototype._update = function(ipAddress, macAddress) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update', sqlUpdateTableEntryByIpAddress, [
            updatedDate,
            macAddress,
            ipAddress
        ],
        function(error, lastId, changes) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {}
        }, true);
}

arp.prototype._delete = function(oldestDate) {
    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:delete', sqlDeleteFromTableOldEntries, [updatedDate],
        function(error, lastId, changes) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {}
        });
}

var instance = new arp();

function eventListener(query, parameters, callback, ignore) {
    if (ignore === undefined || ignore !== null && !ignore) {
        instance._listen(query, parameters, callback);
    }
};

instance.listener = eventListener;

module.exports = instance;
