/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function device() {
    var moduleManager = {};
    var listener = undefined;
}

device.prototype.type = "PERSON";

device.prototype.name = "device";

device.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

device.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.moduleManager.on('monitor:macAddress:create', this._online);
    this.moduleManager.on('monitor:macAddress:delete', this._offline);
}

device.prototype.unload = function() {
    this.stop();
}

device.prototype.start = function() {
    this.moduleManager.on('database:monitor:create', this.listener);
    this.moduleManager.on('database:monitor:update', this.listener);
}

device.prototype.stop = function() {
    this.moduleManager.removeListener('database:monitor:create', this.listener);
    this.moduleManager.removeListener('database:monitor:update', this.listener);
}

device.prototype._online = function(macAddress) {
    console.log(macAddress + ' just came online');
}

device.prototype._offline = function(macAddress) {
    console.log(macAddress + ' just went offline');
}

module.exports = new device();
