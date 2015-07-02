/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function ip() {
    var moduleManager = {};
}

ip.prototype.type = "MONITOR";

ip.prototype.name = "ip";

ip.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

ip.prototype.load = function(moduleManager) {
    var self = this;
    this.moduleManager = moduleManager;


    setTimeout(function() {
        self.start()
    }, 10000);
}

ip.prototype.unload = function() {}

ip.prototype.start = function() {

}

module.exports = new ip();
