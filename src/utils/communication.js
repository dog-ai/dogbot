/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var events = require('events');

function communication() {
    events.EventEmitter.call(this);
}

communication.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = new communication();