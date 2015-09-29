/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

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
    this.moduleManager.on('person:employee:nearby', this._handleEmployeeNearby);
    this.moduleManager.on('person:employee:faraway', this._handleEmployeeFaraway);
    this.moduleManager.on('person:employee:online', this._handleEmployeeOnline);
    this.moduleManager.on('person:employee:offline', this._handleEmployeeOffline);
};

notification.prototype.stop = function () {
    this.moduleManager.removeListener('person:employee:nearby', this._handleEmployeeNearby);
    this.moduleManager.removeListener('person:employee:faraway', this._handleEmployeeFaraway);
    this.moduleManager.removeListener('person:employee:online', this._handleEmployeeOnline);
    this.moduleManager.removeListener('person:employee:offline', this._handleEmployeeOffline);
};

notification.prototype._handleEmployeeNearby = function (employee) {
    logger.log(new Date() + ' ' + employee.full_name + ' is nearby');
};

notification.prototype._handleEmployeeFaraway = function (employee) {
    logger.log(new Date() + ' ' + employee.full_name + ' is faraway');
};

notification.prototype._handleEmployeeOnline = function (employee) {
    logger.log(new Date() + ' ' + employee.full_name + ' is online');
};

notification.prototype._handleEmployeeOffline = function (employee) {
    logger.log(new Date() + ' ' + employee.full_name + ' is offline');
};

var instance = new notification();

module.exports = instance;
