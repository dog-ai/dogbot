/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../var/db/";
var file = path + "monitor.db";
var db = new sqlite3.Database(file);

function monitor() {
    var databaseManager = {};
}

monitor.prototype.type = 'SQL';

monitor.prototype.name = "monitor";

monitor.prototype.start = function (databaseManager) {
    this.databaseManager = databaseManager;

    this.databaseManager.on('database:monitor:setup', this._run);
    this.databaseManager.on('database:monitor:create', this._run);
    this.databaseManager.on('database:monitor:retrieveOne', this._get);
    this.databaseManager.on('database:monitor:retrieveAll', this._all);
    this.databaseManager.on('database:monitor:retrieveOneByOne', this._each);
    this.databaseManager.on('database:monitor:update', this._run);
    this.databaseManager.on('database:monitor:delete', this._run);
};

monitor.prototype.stop = function () {
    db.close();
};

monitor.prototype._run = function(query, parameters, callback) {
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

monitor.prototype._get = function(query, parameters, callback) {
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

monitor.prototype._all = function(query, parameters, callback) {
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

monitor.prototype._each = function (query, parameters, callback) {
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

module.exports = new monitor();
