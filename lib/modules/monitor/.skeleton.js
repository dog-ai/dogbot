/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function skeleton() {
    var moduleManager = {};
}

skeleton.prototype.type = "MONITOR";

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

skeleton.prototype.start = function() {
}

skeleton.prototype.stop = function() {
}

module.exports = new skeleton();
