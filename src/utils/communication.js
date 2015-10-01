/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var events = require('events');
var Promise = require('bluebird');

function communication() {
    events.EventEmitter.call(this);
}

communication.prototype.__proto__ = events.EventEmitter.prototype;

communication.prototype.emitAsync = Promise.promisify(events.EventEmitter.prototype.emit);

module.exports = new communication();