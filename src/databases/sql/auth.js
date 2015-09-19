/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../var/db/";
var file = path + "auth.db";
var db = new sqlite3.Database(file);

function auth() {
    var databaseManager = {};
}

auth.prototype.type = 'SQL';

auth.prototype.name = "auth";

auth.prototype.start = function (databaseManager) {
    this.databaseManager = databaseManager;

    this.databaseManager.on('database:auth:setup', this._run);
    this.databaseManager.on('database:auth:create', this._run);
    this.databaseManager.on('database:auth:retrieveOne', this._get);
    this.databaseManager.on('database:auth:retrieveAll', this._all);
    this.databaseManager.on('database:auth:retrieveOneByOne', this._each);
    this.databaseManager.on('database:auth:update', this._run);
    this.databaseManager.on('database:auth:delete', this._run);
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
