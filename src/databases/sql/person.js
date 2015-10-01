/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var sql = require('../sql.js');

function person() {
    this.communication = undefined;
}

person.prototype = new sql();

person.prototype.name = "person";

person.prototype.start = function (communication) {
    this.communication = communication;

    this._open(this.name);

    this.communication.on('database:' + this.name + ':setup', this._run);
    this.communication.on('database:' + this.name + ':create', this._run);
    this.communication.on('database:' + this.name + ':retrieveOne', this._get);
    this.communication.on('database:' + this.name + ':retrieveAll', this._all);
    this.communication.on('database:' + this.name + ':retrieveOneByOne', this._each);
    this.communication.on('database:' + this.name + ':update', this._run);
    this.communication.on('database:' + this.name + ':delete', this._run);
};

person.prototype.stop = function () {
    this.communication.removeListener('database:' + this.name + ':setup', this._run);
    this.communication.removeListener('database:' + this.name + ':create', this._run);
    this.communication.removeListener('database:' + this.name + ':retrieveOne', this._get);
    this.communication.removeListener('database:' + this.name + ':retrieveAll', this._all);
    this.communication.removeListener('database:' + this.name + ':retrieveOneByOne', this._each);
    this.communication.removeListener('database:' + this.name + ':update', this._run);
    this.communication.removeListener('database:' + this.name + ':delete', this._run);

    this._close();
};

module.exports = new person();
