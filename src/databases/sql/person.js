/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sql = require('./'),
    util = require('util');

function person() {
    sql.call(this);

    this.communication = undefined;
}

util.inherits(person, sql);

person.prototype.name = 'person';

person.prototype.start = function (communication) {
    var self = this;

    this.communication = communication;

    this.communication.on('database:' + this.name + ':setup', this._run.bind(this));
    this.communication.on('database:' + this.name + ':create', this._run.bind(this));
    this.communication.on('database:' + this.name + ':retrieveOne', this._get.bind(this));
    this.communication.on('database:' + this.name + ':retrieveAll', this._all.bind(this));
    this.communication.on('database:' + this.name + ':retrieveOneByOne', this._each.bind(this));
    this.communication.on('database:' + this.name + ':update', this._run.bind(this));
    this.communication.on('database:' + this.name + ':delete', this._run.bind(this));

    return this._open(this.name, true)
        .then(function () {
            return self.communication.emitAsync('database:person:setup', 'DROP TABLE IF EXISTS mac_address', [])
                .then(function () {
                    return self.communication.emitAsync('database:person:setup',
                        'CREATE TABLE mac_address (' +
                        'id TEXT DEFAULT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'address TEXT PRIMARY KEY NOT NULL, ' +
                        'device_id TEXT DEFAULT NULL, ' +
                        'vendor TEXT DEFAULT NULL, ' +
                        'is_present INTEGER NOT NULL DEFAULT 0, ' +
                        'last_presence_date DATETIME DEFAULT NULL,' +
                        'is_to_be_deleted INTEGER NOT NULL DEFAULT 0,' +
                        'is_synced INTEGER NOT NULL DEFAULT 0, ' +
                        'last_discovery_date DATETIME' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:person:setup', 'DROP TABLE IF EXISTS device', [])
                .then(function () {
                    return self.communication.emitAsync('database:person:setup',
                        'CREATE TABLE device (' +
                        'id TEXT DEFAULT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'employee_id INTEGER REFERENCES employee(id), ' +
                        'is_present INTEGER NOT NULL DEFAULT 0, ' +
                        'is_manual INTEGER NOT NULL DEFAULT 0, ' +
                        'last_presence_date DATETIME, ' +
                        'is_synced INTEGER NOT NULL DEFAULT 0, ' +
                        'name TEXT DEFAULT NULL, ' +
                        'type TEXT DEFAULT NULL, ' +
                        'os TEXT DEFAULT NULL' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:person:setup', 'DROP TABLE IF EXISTS employee', [])
                .then(function () {
                    return self.communication.emitAsync('database:person:setup',
                        'CREATE TABLE employee (' +
                        'id TEXT PRIMARY KEY NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'full_name TEXT NOT NULL UNIQUE, ' +
                        'is_present INTEGER NOT NULL DEFAULT 0, ' +
                        'slack_id TEXT, ' +
                        'last_presence_date DATETIME, ' +
                        'is_synced INTEGER NOT NULL DEFAULT 0' +
                        ');',
                        []);
                })
        })
        ;
};

person.prototype.stop = function () {
    this.communication.removeListener('database:' + this.name + ':setup', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':create', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveOne', this._get.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveAll', this._all.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveOneByOne', this._each.bind(this));
    this.communication.removeListener('database:' + this.name + ':update', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':delete', this._run.bind(this));

    return this._close();
};

module.exports = new person();
