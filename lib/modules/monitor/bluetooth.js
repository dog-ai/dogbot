/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var noble = require('noble');

function bluetooth() {
    var moduleManager = {};
}

bluetooth.prototype.type = "MONITOR";

bluetooth.prototype.name = "bluetooth";

bluetooth.prototype.info = function() {
    return "*" + this.name + "* - _Bluetooth monitor module_";
}

bluetooth.prototype.start = function() {

    noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            noble.startScanning([], false);
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function(peripheral) {
        console.log("Detected bluetooth device: " +
                    peripheral.advertisement.localName + " (" + peripheral.uuid + ")");
        peripheral.connect(function(err) {
            if (err) {
                console.log(err);
            } else {
                peripheral.discoverServices([peripheral.uuid], function(err, services) {
                    if (err) {
                        console.log(err);
                    } else {
                        services.forEach(function(service) {
                            console.log('Detected bluetooth service: ' + service);
                            service.discoverCharacteristics([], function(err, characteristics) {

                                characteristics.forEach(function(characteristic) {});
                            });
                        });
                    }
                });
            }
        });
    });

}

module.exports = new bluetooth();
