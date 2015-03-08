/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function hear() {}

hear.prototype.type = "IO";

hear.prototype.name = "hear";

hear.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

hear.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

hear.prototype.unload = function() {}

hear.prototype.send = function(recipient, message) {}

module.exports = new hear();
