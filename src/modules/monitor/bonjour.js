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
    "ip_address TEXT NOT NULL, " +
    "port INTEGER, " +
    "txt TEXT NOT NULL, " +
    "UNIQUE(type, name)" +
    ");";

var sqlInsertEntryIntoTable = "INSERT INTO bonjour (type, name, ip_address, hostname, port, txt) VALUES (?, ?, ?, ?, ?, ?);";

var sqlUpdateTableEntryByTypeAndName = "UPDATE bonjour SET updated_date = ?, ip_address = ?, hostname = ?, port = ?, txt = ? WHERE type = ? AND name = ?;";

var sqlSelectFromTableByTypeAndName = "SELECT * FROM bonjour WHERE type = ? AND name = ?;";

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
};

bonjour.prototype.load = function(moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.moduleManager.emit('database:monitor:setup', sqlCreateTable, [], function(error) {
        if (error !== undefined && error !== null) {
            throw new Error(error);
        } else {
            self.start();
        }
    });
};

bonjour.prototype.unload = function() {
    this.stop();
};

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
    }, 2 * 60 * 1000);
};

bonjour.prototype.stop = function() {
    clearInterval(this.discoverInterval);
    clearInterval(this.cleanInterval);
};

bonjour.prototype._discover = function() {
    //console.log("Discovering bonjour services");

    var self = this;

    var spawn = require('child_process').spawn,
        process = spawn('avahi-browse', ['-alrpc']);

    process.stdout.setEncoding('utf8');
    process.stdout.pipe(require('split')()).on('data', function(line) {
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

        self.moduleManager.emit('database:monitor:retrieve', sqlSelectFromTableByTypeAndName, [type, name],
            function(error, row) {
                if (error !== null) {
                    console.error(error);
                } else {
                    if (row === undefined) {
                        //console.log("Adding bonjour service: " + name + " (" + type + ") at " + address + ":" + port);
                        self._add(type, name, address, hostname, port, txt);
                    } else {
                        //console.log("Updating bonjour service: " + name + " (" + type + ") at " + address + ":" + port);
                        self._update(type, name, address, hostname, port, txt);
                    }
                }
            });
    });

    process.stderr.on('data', function(data) {});
};

bonjour.prototype._clean = function() {
    //console.log("Cleaning old bonjour services");

    var currentDate = new Date();
    this._delete(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)));
};

bonjour.prototype._add = function(type, name, address, hostname, port, txt) {
    var self = this;

    this.moduleManager.emit('database:monitor:create', sqlInsertEntryIntoTable, [
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
                self.moduleManager.emit('monitor:ipAddress:create', address);
            }
        });

};

bonjour.prototype._update = function(type, name, address, hostname, port, txt) {
    var self = this;

    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update', sqlUpdateTableEntryByTypeAndName, [
            updatedDate,
            address,
            hostname,
            port,
            txt,
            type,
            name
        ],
        function(error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('monitor:ipAddress:update', address);
            }
        });
};

bonjour.prototype._delete = function(oldestDate) {
   var self = this;

   var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

   this.moduleManager.emit('database:monitor:retrieveAll',
       "SELECT * FROM bonjour WHERE updated_date < Datetime(?);", [updatedDate],
        function(error, row) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                var that = self;
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM bonjour WHERE id = ?;", [row.id],
                    function(error) {
                        if (error !== undefined && error !== null) {
                            console.error(error);
                        } else {
                            that.moduleManager.emit('monitor:ipAddress:delete', row.ip_address);
                        }
                    });
            }
        });
};

module.exports = new bonjour();
