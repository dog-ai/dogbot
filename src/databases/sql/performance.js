/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var path = __dirname + "/../../../var/db/";
var file = path + "performance.db";
var db = new sqlite3.Database(file);

function performance() {
    var databaseManager = {};
}

performance.prototype.type = 'SQL';

performance.prototype.name = "performance";

performance.prototype.start = function (databaseManager) {
    this.databaseManager = databaseManager;

    this.databaseManager.on('database:performance:setup', this._run);
    this.databaseManager.on('database:performance:create', this._run);
    this.databaseManager.on('database:performance:retrieveOne', this._get);
    this.databaseManager.on('database:performance:retrieveAll', this._all);
    this.databaseManager.on('database:performance:retrieveOneByOne', this._each);
    this.databaseManager.on('database:performance:update', this._run);
    this.databaseManager.on('database:performance:delete', this._run);
};

performance.prototype.stop = function () {
    db.close();
};

performance.prototype._run = function (query, parameters, callback) {
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

performance.prototype._get = function (query, parameters, callback) {
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

performance.prototype._all = function (query, parameters, callback) {
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

performance.prototype._each = function (query, parameters, callback) {
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

module.exports = new performance();
