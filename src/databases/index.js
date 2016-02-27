/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
    async = require('async'),
    _ = require('lodash'),
    path = require('path'),
    fs = require("fs");

var DATABASES_DIR = path.join(__dirname, '/');

function databases() {
}

databases.prototype.startDatabase = function (type, name) {

    if (_.find(this.started, {type: type, name: name})) {
        return;
    }

    return this._start(type, name);
};

databases.prototype.stopDatabase = function (type, name) {

    var database = _.find(this.started, {type: type, name: name});

    if (!database) {
        return;
    }

    return this._stop(database);
};

databases.prototype._start = function (type, name) {
    var self = this;

    return new Promise(function (resolve, reject) {

        var file = name + '.js';

        try {
            var database = require(DATABASES_DIR + type.toLowerCase() + '/' + file);

            return database.start(self.communication)
                .then(function (result) {
                    self.started.push(database);

                    logger.debug('Started ' + type.toLowerCase() + ' database: ' + database.name);

                    resolve(result);
                })
                .catch(function (error) {
                    reject(error);
                });

        } catch (error) {
            logger.debug('Unable to start ' + type.toLowerCase() + ' database ' + file + ' because ' + error.message);

            reject(new Error('unable to start ' + type.toLowerCase() + ' database ' + file));
        }
    });
};

databases.prototype._stop = function (database) {
    var self = this;

    return database.stop()
        .then(function () {
            _.remove(self.started, {name: database.name});

            logger.debug('Stopped database: ' + database.name);
        })
        .catch(function (error) {
            logger.debug('Unable to stop database ' + database.name + ' because ' + error.message);
            throw new Error('unable to stop ' + type.toLowerCase() + ' database ' + file);
        });
};

module.exports = function (communication) {
    var instance = new databases();

    instance.communication = communication;
    instance.started = [];
    instance.types = (fs.readdirSync(DATABASES_DIR) || []).filter(function (type) {
        return type.indexOf('.') <= -1;
    }).map(function (type) {
        return type.toUpperCase();
    });

    return instance;
};