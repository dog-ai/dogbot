/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function user() {
    var moduleManager = {};
    var listener = undefined;
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
    this.moduleManager.on('person:device:online', this._online);
    this.moduleManager.on('person:device:offline', this._offline);
};

user.prototype.stop = function () {
};

user.prototype._online = function (name) {
    var self = this;

    this._retrieve(name, function (name) {
        self.emit('person:user:online', name);
    });
};

user.prototype._offline = function (macAddress) {
    var self = this;

    console.log(new Date() + ' ' + macAddress + ' just went offline');

    this._retrieve(macAddress, function (name) {
        self.emit('person:user:offline', name);
    });
};

module.exports = new user();
