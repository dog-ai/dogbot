/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

var DB_DIR = __dirname + "/../../var/db";

// TODO: can't seem to do proper class inherintance inside function sql() {}
var file = undefined,
    db = undefined;

function sql() {
}

sql.prototype.type = 'SQL';

sql.prototype._open = function (name) {
    file = DB_DIR + '/' + name + '.db';
    db = new sqlite3.Database(file);
};

sql.prototype._close = function () {
    db.close();
};

sql.prototype._run = function (query, parameters, callback) {
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

sql.prototype._get = function (query, parameters, callback) {
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

sql.prototype._all = function (query, parameters, callback) {
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

sql.prototype._each = function (query, parameters, callback) {
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

module.exports = sql;
