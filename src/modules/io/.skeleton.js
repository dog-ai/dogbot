/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var events = require('events');

function skeleton() {
    events.EventEmitter.call(this);
}

skeleton.prototype.__proto__ = events.EventEmitter.prototype;

skeleton.prototype.type = "IO";

skeleton.prototype.name = "skeleton";

skeleton.prototype.info = function() {
    return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

skeleton.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

skeleton.prototype.unload = function() {
}

skeleton.prototype.send = function(recipient, message) {
}

module.exports = new skeleton();
