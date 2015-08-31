/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var path = require('path');
var fs = require("fs");

var databasesDir = path.join(__dirname, 'databases/');

function databases() {
}

databases.prototype.startAll = function (callback) {
    var self = this;

    self.types.forEach(function (type) {
        self._startAllByType(type);
    });

    callback();
};

databases.prototype._startAllByType = function (type) {
    var self = this;

    var dir = path.join(databasesDir + type.toLowerCase());

    fs.readdirSync(dir).forEach(function (file) {
        self._start(type, file);
    });
};

databases.prototype._start = function (type, file) {
    var self = this;

    try {
        var database = require(databasesDir + type.toLowerCase() + '/' + file);

        database.start(self.communication);
        self.started.push(database);

        console.log('Started ' + type.toLowerCase() + ' database: ' + database.name);
    } catch (error) {
        console.log('Unable to start ' + type.toLowerCase() + ' database ' + file + ' because ' + error.message);
    }
};

databases.prototype.stopAll = function () {
    var self = this;

    self.started.forEach(function (database) {
        self._stop(database);
    });
};

databases.prototype._stop = function (database) {
    try {
        database.stop();
        console.log('Stopped database: ' + database.name);
    } catch (exception) {
        console.log('Unable to stop database ' + database.name + ' because ' + exception.message);
    }
};

module.exports = function (communication) {
    var instance = new databases(communication);

    instance.communication = communication;
    instance.started = [];
    instance.types = (fs.readdirSync(databasesDir) || []).map(function (type) {
        return type.toUpperCase();
    });

    return instance;
};