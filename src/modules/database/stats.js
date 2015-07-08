/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var db = new sqlite3.Database(":memory:");

function stats() {
    var moduleManager = {};
}

stats.prototype.type = "DATABASE";

stats.prototype.name = "stats";

stats.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

stats.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

stats.prototype.unload = function () {
    this.stop();
};

stats.prototype.start = function () {
    this.moduleManager.on('database:stats:setup', this._run);
    this.moduleManager.on('database:stats:create', this._run);
    this.moduleManager.on('database:stats:retrieveOne', this._get);
    this.moduleManager.on('database:stats:retrieveAll', this._all);
    this.moduleManager.on('database:stats:retrieveOneByOne', this._each);
    this.moduleManager.on('database:stats:update', this._run);
    this.moduleManager.on('database:stats:delete', this._run);
};

stats.prototype.stop = function () {
    db.close();
};

stats.prototype._run = function (query, parameters, callback) {
    var handler = function (error) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            callback(null, this.lastID, this.changes);
        }
    };

    if (parameters) {
        db.run(query, parameters, handler);
    } else {
        db.run(query, handler);
    }
};

stats.prototype._get = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            callback(null, row);
        }
    };

    if (parameters) {
        db.get(query, parameters, handler);
    } else {
        db.get(query, handler);
    }
};

stats.prototype._all = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            callback(null, row);
        }
    };

    if (parameters) {
        db.all(query, parameters, handler);
    } else {
        db.all(query, handler);
    }
};

stats.prototype._each = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            callback(null, row);
        }
    };

    if (parameters) {
        db.each(query, parameters, handler);
    } else {
        db.each(query, handler);
    }
};

module.exports = new stats();
