/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sqlite3 = require("sqlite3").verbose(),
    Promise = require('bluebird');

var DB_DIR = __dirname + "/../../../var/db";
var TMP_DIR = __dirname + "/../../../var/tmp";

function sql() {
}

sql.prototype.type = 'sql';

sql.prototype._open = function (name, isTemp) {
    var self = this;

    return new Promise(function (resolve, reject) {

        self.file = (isTemp !== undefined && isTemp ? TMP_DIR : DB_DIR) + '/' + name + '.db';

        self.db = new sqlite3.Database(self.file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (error) {
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    });
};

sql.prototype._close = function () {
    var self = this;

    return new Promise(function (resolve, reject) {
        self.db.close(function (error) {
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    });
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
