/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Bot = require('../../bot')

var sql = require('./'),
  util = require('util');

function monitor() {
  sql.call(this);

  this._runFn = this._run.bind(this);
  this._getFn = this._get.bind(this);
  this._allFn = this._all.bind(this);
  this._eachFn = this._each.bind(this);
}

util.inherits(monitor, sql);

monitor.prototype.name = 'monitor';

monitor.prototype.start = function () {
  Bot.on('database:' + this.name + ':setup', this._runFn);
  Bot.on('database:' + this.name + ':create', this._runFn);
  Bot.on('database:' + this.name + ':retrieveOne', this._getFn);
  Bot.on('database:' + this.name + ':retrieveAll', this._allFn);
  Bot.on('database:' + this.name + ':retrieveOneByOne', this._eachFn);
  Bot.on('database:' + this.name + ':update', this._runFn);
  Bot.on('database:' + this.name + ':delete', this._runFn);

  return this._open(this.name, true)
    .then(function () {
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS arp', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
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
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS bonjour', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
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
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS upnp', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
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
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS ip', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
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
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS slack', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
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
    .then(function () {
      return Bot.emitAsync('database:monitor:setup', 'DROP TABLE IF EXISTS dhcp', [])
        .then(function () {
          return Bot.emitAsync('database:monitor:setup',
            'CREATE TABLE dhcp (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
            'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
            'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
            'mac_address TEXT NOT NULL, ' +
            'hostname TEXT NOT NULL,' +
            'UNIQUE(mac_address, hostname)' +
            ');',
            []);
        })
    })
    ;
};

monitor.prototype.stop = function () {
  Bot.removeListener('database:' + this.name + ':setup', this._runFn);
  Bot.removeListener('database:' + this.name + ':create', this._runFn);
  Bot.removeListener('database:' + this.name + ':retrieveOne', this._getFn);
  Bot.removeListener('database:' + this.name + ':retrieveAll', this._allFn);
  Bot.removeListener('database:' + this.name + ':retrieveOneByOne', this._eachFn);
  Bot.removeListener('database:' + this.name + ':update', this._runFn);
  Bot.removeListener('database:' + this.name + ':delete', this._runFn);

  return this._close();
};

module.exports = new monitor();
