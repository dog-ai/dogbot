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

    this.moduleManager.on('database:stats:setup', this._run);

    this.moduleManager.on('database:stats:create', this._run);
    this.moduleManager.on('database:stats:retrieve', this._get);
    this.moduleManager.on('database:stats:retrieveAll', this._all);
    this.moduleManager.on('database:stats:update', this._run);
    this.moduleManager.on('database:stats:delete', this._run);
};

stats.prototype._run = function (query, parameters, callback) {
    var handler = function (error) {
        if (error !== null) {
            if (callback !== undefined) {
                callback(error);
            }
        } else {
            callback(null, this.lastID, this.changes);
        }
    };

    if (parameters !== undefined) {
        db.run(query, parameters, handler);
    } else {
        db.run(query, handler);
    }
};

stats.prototype._get = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (callback !== undefined && error !== null) {
            callback(error);
        } else {
            callback(null, row);
        }
    };

    if (parameters !== undefined) {
        db.get(query, parameters, handler);
    } else {
        db.get(query, handler);
    }
};

stats.prototype._all = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (callback !== undefined && error !== null) {
            callback(error);
        } else {
            callback(null, row);
        }
    };

    if (parameters !== undefined) {
        db.all(query, parameters, handler);
    } else {
        db.all(query, handler);
    }
};

stats.prototype.unload = function () {
    db.close();
};

module.exports = new stats();
