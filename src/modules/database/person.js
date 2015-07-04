/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../db";
var file = __dirname + "/../../../db/person.db";
var db = new sqlite3.Database(file);

function person() {
    var moduleManager = {};
}

person.prototype.type = "DATABASE";

person.prototype.name = "person";

person.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

person.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('database:person:setup', this._run);

    this.moduleManager.on('database:person:create', this._run);
    this.moduleManager.on('database:person:retrieve', this._get);
    this.moduleManager.on('database:person:retrieveAll', this._all);
    this.moduleManager.on('database:person:update', this._run);
    this.moduleManager.on('database:person:delete', this._run);

    if (!fs.existsSync(file)) {
        fs.mkdirSync(path);
    }
}

person.prototype._run = function(query, parameters, callback) {
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

person.prototype._get = function(query, parameters, callback) {
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

person.prototype._all = function(query, parameters, callback) {
    var handler = function(error, row) {
        if (callback !== undefined && error !== null) {
            callback(error);
        } else {
            callback(null, row);
        }
    };

    if (parameters !== undefined) {
        db.each(query, parameters, handler);
    } else {
        db.each(query, handler);
    }
}

person.prototype.unload = function() {
    db.close();
}

module.exports = new person();
