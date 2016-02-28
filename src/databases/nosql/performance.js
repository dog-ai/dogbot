/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var nosql = require('./'),
    util = require("util");

function performance() {
    nosql.call(this);

    this.communication = undefined;

    this._setFn = this._set.bind(this);
    this._getFn = this._get.bind(this);
    this._hmsetFn = this._hmset.bind(this);
    this._hgetallFn = this._hgetall.bind(this);
}

util.inherits(performance, nosql);

performance.prototype.name = "performance";

performance.prototype.start = function (communication) {
    this.communication = communication;

    this.communication.on('database:nosql:' + this.name + ':set', this._setFn);
    this.communication.on('database:nosql:' + this.name + ':get', this._getFn);
    this.communication.on('database:nosql:' + this.name + ':hmset', this._hmsetFn);
    this.communication.on('database:nosql:' + this.name + ':hgetall', this._hgetallFn);

    return this._open(this.name);
};

performance.prototype.stop = function () {
    this.communication.removeListener('database:nosql:' + this.name + ':set', this._setFn);
    this.communication.removeListener('database:nosql:' + this.name + ':get', this._getFn);
    this.communication.removeListener('database:nosql:' + this.name + ':hmset', this._hmsetFn);
    this.communication.removeListener('database:nosql:' + this.name + ':hgetall', this._hgetallFn);

    return this._close();
};

module.exports = new performance();
