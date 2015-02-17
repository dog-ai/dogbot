/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

//var mdns = require('mdns');

function bonjour() {
    var moduleManager = {};
}

bonjour.prototype.type = "MONITOR";

bonjour.prototype.name = "bonjour";

bonjour.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
}

bonjour.prototype.start = function() {

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    var spawn = require('child_process').spawn,
        avahi = spawn('avahi-browse', ['avahi-browse -a -l -r -p']);

    avahi.stdout.on('data', function(data) {
        console.log(data);
    });

    avahi.stderr.on('data', function (data) {
      console.log('stderr: ' + data);
    });

    avahi.on('close', function (code) {
      console.log('child process exited with code ' + code);
    });

    /*try {
        var browser = mdns.browseThemAll();
        browser.on('serviceUp', function(service) {
            console.log("Detected bonjour service: " + service.type.name);
        });
        browser.on('serviceDown', function(service) {
        });
        browser.start();
    } catch (exception) {
        console.error(exception);
    }*/
}

module.exports = new bonjour();
