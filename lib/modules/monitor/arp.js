/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var sqlCreateTable = "CREATE TABLE IF NOT EXISTS arp (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "ip_address TEXT NOT NULL, " +
    "mac_address TEXT NOT NULL" +
    ");"

var sqlInsertEntryIntoTable = "INSERT INTO arp (ip_address, mac_address) VALUES (?, ?);";

var sqlUpdateTableEntryByName = "UPDATE arp SET updated_date = ?, mac_address = ? WHERE ip_address = ? ;";

var sqlSelectFromTableByName = "SELECT * FROM arp WHERE ip_address = ?;";

var sqlDeleteFromTableOldEntries = "DELETE FROM arp WHERE updated_date < ?";

function arp() {
    var moduleManager = {};
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

    this.moduleManager.emit('database:network:setup', sqlCreateTable, [], function(error) {
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
    this.moduleManager.on('database:network:create', this._listen);
    this.moduleManager.on('database:network:update', this._listen);
}

arp.prototype.stop = function() {}

arp.prototype._listen = function(query, parameters, callback) {
    var self = this;

    if (parameters !== undefined) {
        parameters.forEach(function(parameter) {
            if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(parameter)) {
                /*self._resolve(parameter, function(error, mac) {
                    if (error !== undefined && error !== null) {
                        console.error(error);
                    } else {
                        console.log("Resolve ip address " + ip + " to mac address " + mac);
                    }
                });*/
            }
        });
    }
}

arp.prototype._resolve = function(ip, callback) {
    require('child_process')
        .exec('arp -an ' + ip,
            function(error, stdout, stderr) {
                if (error !== undefined && error !== null) {
                    callback(error);
                } else {
                    if (callback !== undefined) {
                        var values = stdout.split(' ');
                        var mac = values[3];
                        callback(mac);
                    }
                }
            });
}

module.exports = new arp();
