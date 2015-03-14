/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var file = __dirname + "/../../../db/auth.db";
var db = new sqlite3.Database(file);

function auth() {
    var moduleManager = {};
}

auth.prototype.type = "DATABASE";

auth.prototype.name = "auth";

auth.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

auth.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('database:auth:setup', this._run);

    this.moduleManager.on('database:auth:create', this._run);
    this.moduleManager.on('database:auth:retrieveAll', this._all);
    this.moduleManager.on('database:auth:retrieve', this._get);
    this.moduleManager.on('database:auth:update', this._run);
    this.moduleManager.on('database:auth:delete', this._run);

    if (!fs.existsSync(file)) {

    }
}

auth.prototype._run = function(query, parameters, callback) {
    var handler = function(error) {
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
}

auth.prototype._get = function(query, parameters, callback) {
    var handler = function(error, row) {
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
}

auth.prototype._all = function(query, parameters, callback) {
    var handler = function(error, row) {
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
}

auth.prototype.unload = function() {
    db.close();
}

module.exports = new auth();
