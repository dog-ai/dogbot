/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose();

function sql() {
    this.path = __dirname + "/../../../var/db/";
    this.file = undefined;
    this.db = undefined;
}

sql.prototype.type = 'SQL';

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
        this.db.run(query, parameters, handler);
    } else {
        this.db.run(query, handler);
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
        this.db.get(query, parameters, handler);
    } else {
        this.db.get(query, handler);
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
        this.db.all(query, parameters, handler);
    } else {
        this.db.all(query, handler);
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
        this.db.each(query, parameters, handler);
    } else {
        this.db.each(query, handler);
    }
};

module.exports = sql;
