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
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
}

device.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
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

var instance = new device();

function eventListener(query, parameters, callback, ignore) {
};

instance.listener = eventListener;

module.exports = instance;
