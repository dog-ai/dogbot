/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

var browser = require('airplay').createBrowser();
var browser2 = require('airplay2').createBrowser();
var airtunes = require('airtunes');

function airplay() {
    var moduleManager = {};
}

airplay.prototype.type = "MONITOR";

airplay.prototype.name = "airplay";

airplay.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

airplay.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    setTimeout(this.start(), 3000);
};

airplay.prototype.unload = function() {
};

airplay.prototype.start = function() {
    browser.on('deviceOnline', function(device) {
        logger.log('AirPlay device online: ' + device.id);
    });
    browser.start();

    var device = airtunes.add('rpi2.local', {
        port: 36666
    });
    device.on('status', function(status) {
        logger.log('Status: ' + status);
    });
    device.on('error', function(status) {
        logger.log('Error: ' + status);
    });

    browser2.on('deviceOn', function(device) {
        logger.log('AirPlay device online: ' + device.id);
    });
    browser2.start();
};

module.exports = new airplay();
