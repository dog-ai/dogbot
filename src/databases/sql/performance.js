/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Server = require('../../server')

var sql = require('./'),
    util = require('util');

function performance() {
    sql.call(this);

  this._runFn = this._run.bind(this);
    this._getFn = this._get.bind(this);
    this._allFn = this._all.bind(this);
    this._eachFn = this._each.bind(this);
}
util.inherits(performance, sql);

performance.prototype.name = 'performance';

performance.prototype.start = function () {
  Server.on('database:' + this.name + ':setup', this._runFn)
  Server.on('database:' + this.name + ':create', this._runFn)
  Server.on('database:' + this.name + ':retrieveOne', this._getFn)
  Server.on('database:' + this.name + ':retrieveAll', this._allFn)
  Server.on('database:' + this.name + ':retrieveOneByOne', this._eachFn)
  Server.on('database:' + this.name + ':update', this._runFn)
  Server.on('database:' + this.name + ':delete', this._runFn)

    return this._open(this.name)
        .then(function () {
          return Server.emitAsync('database:performance:setup',
                'CREATE TABLE IF NOT EXISTS presence (' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
                'created_date DATETIME DEFAULT CURRENT_TIMESTAMP, ' +
                'employee_id TEXT NOT NULL, ' +
                'is_present INTEGER NOT NULL, ' +
                'is_synced INTEGER NOT NULL DEFAULT 0, ' +
                'UNIQUE(created_date, employee_id)' +
                ');',
                []);
        })
        ;
};

performance.prototype.stop = function () {
  Server.removeListener('database:' + this.name + ':setup', this._runFn)
  Server.removeListener('database:' + this.name + ':create', this._runFn)
  Server.removeListener('database:' + this.name + ':retrieveOne', this._getFn)
  Server.removeListener('database:' + this.name + ':retrieveAll', this._allFn)
  Server.removeListener('database:' + this.name + ':retrieveOneByOne', this._eachFn)
  Server.removeListener('database:' + this.name + ':update', this._runFn)
  Server.removeListener('database:' + this.name + ':delete', this._runFn)

    return this._close();
};

module.exports = new performance();
