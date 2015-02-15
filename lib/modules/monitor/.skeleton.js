/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function skeleton() {
    var bot = {};
}

skeleton.prototype.type = "MONITOR";

skeleton.prototype.name = "skeleton";

skeleton.prototype.info = function() {
    return "*" + this.name + "* -" +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + "_ " +
    this.type.toLowerCase() + " module_";
}

skeleton.prototype.start = function() {
}

module.exports = new skeleton();
