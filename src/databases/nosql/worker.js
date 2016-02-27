/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
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
    var self = this;

    return this._open()
        .then(function (result) {
            result.prefix = self.name;
            return result;
        });
};

worker.prototype.stop = function () {
    return this._close();
};

module.exports = new worker();
