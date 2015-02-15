/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var mdns = require('mdns');

function bonjour() {
    var bot = {};
}

bonjour.prototype.type = "MONITOR";

bonjour.prototype.name = "bonjour";

bonjour.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

bonjour.prototype.start = function() {
    var browser = mdns.browseThemAll();
    browser.on('serviceUp', function(service) {
        console.log("Detected bonjour service: " + service.type.name);
    });
    browser.on('serviceDown', function(service) {
    });
    browser.start();
}

module.exports = new bonjour();
