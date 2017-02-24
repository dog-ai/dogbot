/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Bot = require('../../bot')

var nosql = require('./'),
    util = require("util");

function performance() {
    nosql.call(this);

  this._setFn = this._set.bind(this);
    this._getFn = this._get.bind(this);
    this._hsetFn = this._hset.bind(this);
    this._hgetFn = this._hget.bind(this);
    this._hmsetFn = this._hmset.bind(this);
    this._hgetallFn = this._hgetall.bind(this);
}

util.inherits(performance, nosql);

performance.prototype.name = "performance";

performance.prototype.start = function () {
  Bot.on('database:nosql:' + this.name + ':set', this._setFn);
  Bot.on('database:nosql:' + this.name + ':get', this._getFn);
  Bot.on('database:nosql:' + this.name + ':hset', this._hsetFn);
  Bot.on('database:nosql:' + this.name + ':hget', this._hgetFn);
  Bot.on('database:nosql:' + this.name + ':hmset', this._hmsetFn);
  Bot.on('database:nosql:' + this.name + ':hgetall', this._hgetallFn);

    return this._open(this.name);
};

performance.prototype.stop = function () {
  Bot.removeListener('database:nosql:' + this.name + ':set', this._setFn);
  Bot.removeListener('database:nosql:' + this.name + ':get', this._getFn);
  Bot.removeListener('database:nosql:' + this.name + ':hset', this._hsetFn);
  Bot.removeListener('database:nosql:' + this.name + ':hget', this._hgetFn);
  Bot.removeListener('database:nosql:' + this.name + ':hmset', this._hmsetFn);
  Bot.removeListener('database:nosql:' + this.name + ':hgetall', this._hgetallFn);

    return this._close();
};

module.exports = new performance();
