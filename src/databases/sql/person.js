/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../var/db/";
var file = path + "person.db";
var db = new sqlite3.Database(file);

function person() {
    var databaseManager = {};
}

person.prototype.type = 'SQL';

person.prototype.name = "person";

person.prototype.start = function (databaseManager) {
    this.databaseManager = databaseManager;

    this.databaseManager.on('database:person:setup', this._run);
    this.databaseManager.on('database:person:create', this._run);
    this.databaseManager.on('database:person:retrieveOne', this._get);
    this.databaseManager.on('database:person:retrieveAll', this._all);
    this.databaseManager.on('database:person:retrieveOneByOne', this._each);
    this.databaseManager.on('database:person:update', this._run);
    this.databaseManager.on('database:person:delete', this._run);
};

person.prototype.stop = function () {
    db.close();
};

person.prototype._run = function(query, parameters, callback) {
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

person.prototype._get = function(query, parameters, callback) {
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

person.prototype._all = function(query, parameters, callback) {
    var handler = function(error, row) {
        if (error) {
            if (callback) {
                callback(error);
            }
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

person.prototype._each = function (query, parameters, callback) {
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

module.exports = new person();
