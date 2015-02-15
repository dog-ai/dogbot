/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var noble = require('noble');

function bluetooth() {
    var bot = {};
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
        console.log(peripheral.advertisement.localName + " (" + peripheral.uuid + ")");
    });

}

module.exports = new bluetooth();
