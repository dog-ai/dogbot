/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function network() {
    var moduleManager = {};
}

network.prototype.type = "MONITOR";

network.prototype.name = "network";

network.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

network.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

network.prototype.unload = function() {
}

network.prototype.start = function() {
}

module.exports = new network();
