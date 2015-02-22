/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var file = __dirname + "/../../../db/network.db";
var db = new sqlite3.Database(file);

function network() {
    var moduleManager = {};
}

network.prototype.type = "DATABASE";

network.prototype.name = "network";

network.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

network.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('database:network:setup', this._run);

    this.moduleManager.on('database:network:create', this._run);
    this.moduleManager.on('database:network:retrieve', this._get);
    this.moduleManager.on('database:network:update', this._run);
    this.moduleManager.on('database:network:delete', this._run);

    if (!fs.existsSync(file)) {

    }
}

network.prototype._run = function(query, parameters, callback) {
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

network.prototype._get = function(query, parameters, callback) {
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

network.prototype.unload = function() {
    db.close();
}

module.exports = new network();
