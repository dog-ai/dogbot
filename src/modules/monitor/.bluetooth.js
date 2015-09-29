/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

//var noble = require('noble');

var logger = require('../../utils/logger.js');

function bluetooth() {
    var moduleManager = {};
}

bluetooth.prototype.type = "MONITOR";

bluetooth.prototype.name = "bluetooth";

bluetooth.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

bluetooth.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    setTimeout(this.start(), 6000);
};

bluetooth.prototype.start = function() {

    /*noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            noble.startScanning([], false);
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function(peripheral) {
     logger.info("Detected bluetooth device: " +
                    peripheral.advertisement.localName + " (" + peripheral.uuid + ")");
        peripheral.connect(function(err) {
            if (err) {
     logger.info(err);
            } else {
                peripheral.discoverServices([peripheral.uuid], function(err, services) {
                    if (err) {
     logger.info(err);
                    } else {
                        services.forEach(function(service) {
     logger.info('Detected bluetooth service: ' + service);
                            service.discoverCharacteristics([], function(err, characteristics) {

                                characteristics.forEach(function(characteristic) {});
                            });
                        });
                    }
                });
            }
        });
    });*/

};

bluetooth.prototype.unload = function() {

};

module.exports = new bluetooth();
