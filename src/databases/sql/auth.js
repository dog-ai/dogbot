/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Bot = require('../../bot')

var sql = require('./'),
    util = require('util')
    ;

function auth() {
    sql.call(this);

    this._runFn = this._run.bind(this);
    this._getFn = this._get.bind(this);
    this._allFn = this._all.bind(this);
    this._eachFn = this._each.bind(this);
}

util.inherits(auth, sql);

auth.prototype.name = 'auth';

auth.prototype.start = function () {
  Bot.on('database:' + this.name + ':setup', this._runFn);
  Bot.on('database:' + this.name + ':create', this._runFn);
  Bot.on('database:' + this.name + ':retrieveOne', this._getFn);
  Bot.on('database:' + this.name + ':retrieveAll', this._allFn);
  Bot.on('database:' + this.name + ':retrieveOneByOne', this._eachFn);
  Bot.on('database:' + this.name + ':update', this._runFn);
  Bot.on('database:' + this.name + ':delete', this._runFn);

    return this._open(this.name)
        .then(function () {
          return Bot.emitAsync('database:auth:setup', 'DROP TABLE IF EXISTS google', [])
                .then(function () {
                  return Bot.emitAsync('database:auth:setup',
                        'CREATE TABLE IF NOT EXISTS google (' +
                        'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                        'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                        'user_id TEXT NOT NULL, ' +
                        'name TEXT NOT NULL, ' +
                        'email TEXT NOT NULL, ' +
                        'access_token TEXT NOT NULL, ' +
                        'expires_in INTEGER NOT NULL, ' +
                        'refresh_token TEXT NOT NULL' +
                        ');',
                        []);
                })
        });
};

auth.prototype.stop = function () {
  Bot.removeListener('database:' + this.name + ':setup', this._runFn);
  Bot.removeListener('database:' + this.name + ':create', this._runFn);
  Bot.removeListener('database:' + this.name + ':retrieveOne', this._getFn);
  Bot.removeListener('database:' + this.name + ':retrieveAll', this._allFn);
  Bot.removeListener('database:' + this.name + ':retrieveOneByOne', this._eachFn);
  Bot.removeListener('database:' + this.name + ':update', this._runFn);
  Bot.removeListener('database:' + this.name + ':delete', this._runFn);

    return this._close();
};

module.exports = new auth();
