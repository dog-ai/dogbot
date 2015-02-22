/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var file = __dirname + "/../../../feedeobot.db";
var db = new sqlite3.Database(file);

function sql() {
    var moduleManager = {};
}

sql.prototype.type = "DATABASE";

sql.prototype.name = "sql";

sql.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

sql.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('sql:run', this.run);
    this.moduleManager.on('sql:get', this.get);

    if (!fs.existsSync(file)) {

    }
}

sql.prototype.run = function(query, parameters, callback) {
    var handler = function(error) {
        if (error !== null) {
            if (callback !== undefined) {
                callback(error);
            }
        } else {
            callback();
        }
    };

    if (parameters !== undefined) {
        db.run(query, parameters, handler);
    } else {
        db.run(query, handler);
    }
}

sql.prototype.get = function(query, parameters, callback) {
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

sql.prototype.unload = function() {
    db.close();
}

module.exports = new sql();
