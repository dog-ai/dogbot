/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    Promise = require('bluebird');

function bonjour() {
}

bonjour.prototype.type = "MONITOR";

bonjour.prototype.name = "bonjour";

bonjour.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

bonjour.prototype.load = function (communication) {
    this.communication = communication;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    this.start();
};

bonjour.prototype.unload = function () {
    this.stop();
};

bonjour.prototype.start = function () {
    this.communication.on('monitor:bonjour:discover', this._discover);

    this.communication.emit('worker:job:enqueue', 'monitor:bonjour:discover', null, '3 minute');
};

bonjour.prototype.stop = function () {
    this.communication.removeListener('monitor:bonjour:discover', this._discover);
};

bonjour.prototype._discover = function (params, callback) {
    return instance._execAvahiBrowse()
        .then(function () {
            return instance._clean();
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

bonjour.prototype._execAvahiBrowse = function () {
    return new Promise(function (resolve, reject) {
        var spawn = require('child_process').spawn,
            process = spawn('avahi-browse', ['-alrpck']);

        process.stdout.setEncoding('utf8');
        process.stdout.pipe(require('split')()).on('data', function (line) {
            if (line.charAt(0) !== '=') {
                return;
            }

            var values = line.split(';');

            var bonjour = {
                name: values[3],
                type: values[4],
                hostname: values[6],
                ip_address: values[7],
                port: values[8],
                txt: values[9]
            };

            instance._createOrUpdate(bonjour)
                .catch(function (error) {
                    logger.error(error.stack);
                });
        });

        process.on('error', reject);
        process.on('close', resolve);
    })
};

bonjour.prototype._clean = function () {
    var now = new Date();
    return instance._deleteAllBeforeDate(new Date(now.setMinutes(now.getMinutes() - 15)),
        function (bonjour) {
            instance.communication.emit('monitor:bonjour:delete', bonjour.ip_address);
        });
};

bonjour.prototype._createOrUpdate = function (bonjour) {
    return instance._findByTypeAndName(bonjour.type, bonjour.name)
        .then(function (row) {
            if (row === undefined) {
                return instance._create(bonjour)
                    .then(function () {
                        instance.communication.emit('monitor:bonjour:create', bonjour);
                    });
            } else {
                return instance._updateByTypeAndName(bonjour.type, bonjour.name, bonjour)
                    .then(function () {
                        instance.communication.emit('monitor:bonjour:update', bonjour);
                    });
            }
        });
};

bonjour.prototype._create = function (bonjour) {
    var _bonjour = _.clone(bonjour);

    if (_bonjour.created_date !== undefined && _bonjour.created_date !== null && _bonjour.created_date instanceof Date) {
        _bonjour.created_date = _bonjour.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_bonjour.updated_date !== undefined && _bonjour.updated_date !== null && _bonjour.updated_date instanceof Date) {
        _bonjour.updated_date = _bonjour.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_bonjour);
    var values = _.values(_bonjour);

    return instance.communication.emitAsync('database:monitor:create',
        'INSERT INTO bonjour (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values).then(function () {
        return _bonjour;
    });

};

bonjour.prototype._findByTypeAndName = function (type, name) {
    return instance.communication.emitAsync('database:monitor:retrieveOne',
        "SELECT * FROM bonjour WHERE type = ? AND name = ?;", [type, name])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
            }
            return row;
        });
};

bonjour.prototype._updateByTypeAndName = function (type, name, bonjour) {
    var _bonjour = _.clone(bonjour);

    if (_bonjour.updated_date !== undefined && _bonjour.updated_date !== null && _bonjour.updated_date instanceof Date) {
        _bonjour.updated_date = _bonjour.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_bonjour);
    var values = _.values(_bonjour);

    return instance.communication.emitAsync('database:monitor:update',
        'UPDATE bonjour SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE type = \'' + type + '\' AND name = \'' + name + '\';',
        values);
};

bonjour.prototype._deleteAllBeforeDate = function (oldestDate, callback) {
    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return instance.communication.emitAsync('database:monitor:retrieveAll',
        "SELECT * FROM bonjour WHERE updated_date < Datetime(?);", [updatedDate])
        .then(function (rows) {

            var promises = [];

            _.forEach(rows, function (row) {
                promises.push(instance.communication.emit('database:monitor:delete', "DELETE FROM bonjour WHERE id = ?;", [row.id])
                    .then(function () {
                        callback();
                    }));
            });

            return Promise.all(promises);
        });
};

var instance = new bonjour();

module.exports = instance;
