/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlCreateTable = "CREATE TABLE IF NOT EXISTS bonjour (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "type TEXT NOT NULL, " +
    "name TEXT NOT NULL, " +
    "hostname TEXT NOT NULL, " +
    "address TEXT NOT NULL, " +
    "port INTEGER, " +
    "txt TEXT NOT NULL" +
    ");"

var sqlInsertEntryIntoTable = "INSERT INTO bonjour (type, name, address, hostname, port, txt) VALUES (?, ?, ?, ?, ?, ?);";

var sqlUpdateTableEntryByName = "UPDATE bonjour SET updated_date = ?, type = ?, address = ?, hostname = ?, port = ?, txt = ? WHERE name = ? ;";

var sqlSelectFromTableByName = "SELECT * FROM bonjour WHERE name = ?;";

var sqlDeleteFromTableOldEntries = "DELETE FROM bonjour WHERE updated_date < ?";

function bonjour() {
    var moduleManager = {};
    var discoverInterval = undefined;
    var cleanInterval = undefined;
}

bonjour.prototype.type = "MONITOR";

bonjour.prototype.name = "bonjour";

bonjour.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

bonjour.prototype.load = function(moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.moduleManager.emit('database:network:setup', sqlCreateTable, [], function(error) {
        if (error !== undefined && error !== null) {
            throw new Error(error);
        } else {
            self.start();
        }
    });
}

bonjour.prototype.unload = function() {
    this.stop();
}

bonjour.prototype.start = function() {
    var self = this;

    this.discoverInterval = setInterval(function() {
        try {
            self._discover();
        } catch (error) {
            console.error(error);
        }
    }, 60 * 1000);

    this.cleanInterval = setInterval(function() {
        try {
            self._clean();
        } catch (error) {
            console.error(error);
        }
    }, 24 * 60 * 60 * 1000)
}

bonjour.prototype.stop = function() {
    clearInterval(this.discoverInterval);
    clearInterval(this.cleanInterval);
}

bonjour.prototype._discover = function() {
    console.log("Discovering bonjour services");

    var self = this;

    var spawn = require('child_process').spawn,
        avahi = spawn('avahi-browse', ['-alrpc']);

    avahi.stdout.setEncoding('utf8');
    avahi.stdout.pipe(require('split')()).on('data', function(line) {
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

        self.moduleManager.emit('database:network:retrieve', sqlSelectFromTableByName, [name],
            function(error, row) {
                if (error !== null) {
                    console.error(error);
                } else {
                    if (row === undefined) {
                        console.log("Adding bonjour service: " + name + " (" + type + ") at " + address + ":" + port);

                        self._add(type, name, address, hostname, port, txt);
                    } else {
                        console.log("Updating bonjour service: " + name + " (" + type + ") at " + address + ":" + port);
                        self._update(type, name, address, hostname, port, txt);
                    }
                }
            });
    });

    avahi.stderr.on('data', function(data) {});
}

bonjour.prototype._clean = function() {
    console.log("Cleaning old bonjour services");

    var yesterday = new Date().getDate()-1;
    this._delete(yesterday);
}

bonjour.prototype._add = function(type, name, address, hostname, port, txt) {
    this.moduleManager.emit('database:network:create', sqlInsertEntryIntoTable, [
            type,
            name,
            address,
            hostname,
            port,
            txt
        ],
        function(error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {

            }
        });
}

bonjour.prototype._update = function(type, name, address, hostname, port, txt) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:network:update', sqlUpdateTableEntryByName, [
            updatedDate,
            type,
            address,
            hostname,
            port,
            txt,
            name
        ],
        function(error, lastId, changes) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {}
        });
}

bonjour.prototype._delete = function(oldestDate) {
   var updatedDate = new Date(new Date().setDate(oldestDate)).toISOString().replace(/T/, ' ').replace(/\..+/, '');

   this.moduleManager.emit('database:network:delete', sqlDeleteFromTableOldEntries, [updatedDate],
        function(error, lastId, changes) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {}
        });
}

module.exports = new bonjour();
