/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var nosql = require('./'),
    util = require("util");

function worker() {
    nosql.call(this);

    this.communication = undefined;
}

util.inherits(worker, nosql);

worker.prototype.name = "worker";

worker.prototype.start = function () {
    return this._open();
};

worker.prototype.stop = function () {
    return this._close();
};

module.exports = new worker();
