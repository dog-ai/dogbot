/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../var/db/";
var file = path + "auth.db";
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
};

auth.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

auth.prototype.unload = function () {
    this.stop();
};

auth.prototype.start = function () {
    this.moduleManager.on('database:auth:setup', this._run);
    this.moduleManager.on('database:auth:create', this._run);
    this.moduleManager.on('database:auth:retrieveOne', this._get);
    this.moduleManager.on('database:auth:retrieveAll', this._all);
    this.moduleManager.on('database:auth:retrieveOneByOne', this._each);
    this.moduleManager.on('database:auth:update', this._run);
    this.moduleManager.on('database:auth:delete', this._run);
};

auth.prototype.stop = function () {
    db.close();
};

auth.prototype._run = function(query, parameters, callback) {
    var handler = function(error) {
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

auth.prototype._get = function(query, parameters, callback) {
    var handler = function(error, row) {
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

auth.prototype._all = function(query, parameters, callback) {
    var handler = function(error, row) {
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

auth.prototype._each = function (query, parameters, callback) {
    var handler = function (error, row) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            callback(null, row);
        }
    };

    if (parameters !== undefined) {
        db.each(query, parameters, handler);
    } else {
        db.each(query, handler);
    }
};

module.exports = new auth();
