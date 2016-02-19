/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sql = require('./'),
    util = require('util');

function monitor() {
    sql.call(this);

    this.communication = undefined;
}

util.inherits(monitor, sql);

monitor.prototype.name = 'monitor';

monitor.prototype.start = function (communication) {
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
            return self.communication.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS arp', [])
                .then(function () {
                    return self.communication.emitAsync('database:monitor:setup',
                        'CREATE TABLE arp (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'ip_address TEXT NOT NULL, ' +
                        'mac_address TEXT NOT NULL,' +
                        'UNIQUE(ip_address, mac_address)' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS bonjour', [])
                .then(function () {
                    return self.communication.emitAsync('database:monitor:setup',
                        'CREATE TABLE bonjour (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'type TEXT NOT NULL, ' +
                        'name TEXT NOT NULL, ' +
                        'hostname TEXT NOT NULL, ' +
                        'ip_address TEXT NOT NULL, ' +
                        'port INTEGER, ' +
                        'txt TEXT NOT NULL, ' +
                        'UNIQUE(type, name)' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS upnp', [])
                .then(function () {
                    return self.communication.emitAsync('database:monitor:setup',
                        'CREATE TABLE upnp (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'location TEXT NOT NULL, ' +
                        'ip_address TEXT NOT NULL, ' +
                        'device_friendly_name TEXT NOT NULL, ' +
                        'device_model_name, ' +
                        'device_model_description, ' +
                        'device_manufacturer, ' +
                        'UNIQUE(ip_address)' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS ip', [])
                .then(function () {
                    return self.communication.emitAsync('database:monitor:setup',
                        'CREATE TABLE ip (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'ip_address TEXT NOT NULL UNIQUE' +
                        ');',
                        []);
                })
        })
        .then(function () {
            return self.communication.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS slack', [])
                .then(function () {
                    return self.communication.emitAsync('database:monitor:setup',
                        'CREATE TABLE slack (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'slack_id TEXT NOT NULL UNIQUE, ' +
                        'username TEXT NOT NULL, ' +
                        'name TEXT NOT NULL' +
                        ');',
                        []);
                })
        })
        ;
};

monitor.prototype.stop = function () {
    this.communication.removeListener('database:' + this.name + ':setup', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':create', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveOne', this._get.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveAll', this._all.bind(this));
    this.communication.removeListener('database:' + this.name + ':retrieveOneByOne', this._each.bind(this));
    this.communication.removeListener('database:' + this.name + ':update', this._run.bind(this));
    this.communication.removeListener('database:' + this.name + ':delete', this._run.bind(this));

    return this._close();
};

module.exports = new monitor();
