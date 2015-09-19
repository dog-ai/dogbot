/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var events = require('events');

function communication() {
    events.EventEmitter.call(this);
}

communication.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = new communication();