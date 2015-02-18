/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function skeleton() {
    var moduleManager = {};
}

skeleton.prototype.type = 'SCHEDULE';

skeleton.prototype.name = 'skeleton';

skeleton.prototype.info = function() {
    return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

skeleton.prototype.cron = "0 0 0 0 0 1-5";

skeleton.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

skeleton.prototype.unload = function() {
}

skeleton.prototype.schedule = function() {
}

module.exports = new skeleton();
