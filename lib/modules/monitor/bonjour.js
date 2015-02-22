/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var sqlCreateTable = "CREATE TABLE IF NOT EXISTS bonjour (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "type TEXT NOT NULL, " +
    "name TEXT NOT NULL, " +
    "ip TEXT NOT NULL, " +
    "port INTEGER" +
    ");"

var sqlInsertEntryIntoTable = "INSERT INTO bonjour (type, name, ip, port) VALUES (?, ?, ?, ?);";

var sqlUpdateTableEntryByName = "UPDATE bonjour SET updated_date = ?, type = ?, ip = ?, port = ? WHERE name = ?;";

var sqlSelectFromTableByName = "SELECT * FROM bonjour WHERE name = ?;";

function bonjour() {
    var moduleManager = {};
    var interval = {};
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

    this.moduleManager.emit('sql:run', sqlCreateTable, [], function(error) {
        if (error !== null) {
            console.error(error);
        } else {
            self.start();
        }
    });
}

bonjour.prototype.unload = function() {
    this.stop();
}

bonjour.prototype.start = function() {
    this.interval = setInterval(this._discover(), 60000);
}

bonjour.prototype.stop = function() {
    clearInterval(this.interval);
}

bonjour.prototype._discover = function() {
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
        var addresses = values[7];
        var port = values[8];

        if (type.charAt(0) === '_') {
            return;
        }

        this.moduleManager.emit('sql:get', sqlSelectFromTableByName, [name],
            function(error, row) {
                if (error !== null) {
                    console.error(error);
                } else {
                    if (row === undefined) {
                        self._add(type, name, addresses[0], port);
                    } else {
                        self._update(type, name, addresses[0], port);
                    }
                }
            });
    });

    avahi.stderr.on('data', function(data) {});
}

bonjour.prototype._add = function(type, name, ip, port) {
    console.log("Adding bonjour service to database: " + name + " (" + type + ") at " + ip + ":" + port);

    this.moduleManager.emit('sql:run', sqlInsertEntryIntoTable, [
            type,
            name,
            ip,
            port
        ],
        function(error) {
            if (error !== null) {
                console.error(error);
            }
        });
}

bonjour.prototype._update = function(type, name, ip, port) {
    console.log("Updating bonjour service in database: " + name + " (" + type + ") at " + ip + ":" + port);

    this.moduleManager.emit('sql:run', sqlUpdateTableEntryByName, [
            '"' + new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + '"',
            type,
            name,
            ip,
            port
        ],
        function(error) {
            if (error !== null) {
                console.error(error);
            }
        });
}

module.exports = new bonjour();
