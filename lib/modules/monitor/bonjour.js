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

bonjour.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    if (process.platform !== 'linux') {
        throw new Error(process.platform + ' platform is not supported');
    }

    setTimeout(this.start(), 5000);
}

bonjour.prototype.unload = function() {
}

bonjour.prototype.start = function() {

    this._discover();

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

bonjour.prototype._discover = function() {

    var spawn = require('child_process').spawn,
        avahi = spawn('avahi-browse', ['-alrp']);

    avahi.stdout.setEncoding('utf8');
    avahi.stdout.pipe(require('split')()).on('data', function(line) {
        if (line.charAt(0) !== '=') {
            return;
        }

        var values = line.split(';');

        var name = values[3];
        var type = values[4];
        var hostname = values[6];
        var addresses = values[7];
        var port = values[8];

        if (type.charAt(0) === '*') {
            return;
        }

        console.log('Discovered bonjour service: ' + name + ' (' + type + ') at ' + addresses + ':' + port);
    });

    avahi.stderr.on('data', function(data) {});
}

module.exports = new bonjour();
