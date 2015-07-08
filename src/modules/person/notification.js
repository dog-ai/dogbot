/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function notification() {
    var moduleManager = {};
}

notification.prototype.type = "PERSON";

notification.prototype.name = "notification";

notification.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

notification.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

notification.prototype.unload = function () {
    this.stop();
};

notification.prototype.start = function () {

    this.moduleManager.on('person:employee:nearby', function (employee) {
        console.log(new Date() + ' ' + employee.name + ' is nearby');
    });

    this.moduleManager.on('person:employee:faraway', function (employee) {
        console.log(new Date() + ' ' + employee.name + ' is faraway');
    });

    this.moduleManager.on('person:employee:online', function (employee) {
        console.log(new Date() + ' ' + employee.name + ' is online');
    });

    this.moduleManager.on('person:employee:offline', function (employee) {
        console.log(new Date() + ' ' + employee.name + ' is offline');
    });
};

notification.prototype.stop = function () {
};

module.exports = new notification();
