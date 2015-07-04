/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function user() {
    var moduleManager = {};
}

user.prototype.type = "PERSON";

user.prototype.name = "user";

user.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

user.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;
};

user.prototype.unload = function () {
    this.stop();
};

user.prototype.start = function () {
    var self = this;

    this.moduleManager.on('person:device:online', function (name) {
        console.log(name + ' is online');
    });

    this.moduleManager.on('person:device:offline', function (name) {
        console.log(name + ' is offline');
    });
};

user.prototype.stop = function () {
};

module.exports = new user();
