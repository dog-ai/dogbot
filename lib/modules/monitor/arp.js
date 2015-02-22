/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function arp() {
    var moduleManager = {};
}

arp.prototype.type = "MONITOR";

arp.prototype.name = "arp";

arp.prototype.info = function() {
    return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

arp.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('database:network:create', this._resolve);
    this.moduleManager.on('database:network:update', this._resolve);
}

arp.prototype.unload = function() {
}

arp.prototype.start = function() {
}

arp.prototype.stop = function() {
}

arp.prototype._resolve = function(query, parameters, callback) {
    console.log(parameters);
}


module.exports = new arp();
