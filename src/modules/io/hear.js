/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function hear() {}

hear.prototype.type = "IO";

hear.prototype.name = "hear";

hear.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " I/O module_";
};

hear.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
};

hear.prototype.unload = function () {
};

hear.prototype.send = function (recipient, message) {
};

module.exports = new hear();
