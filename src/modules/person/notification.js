/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  moment = require('moment');

var utils = require('../utils.js');

function notification() {
}

notification.prototype.type = "PERSON";

notification.prototype.name = "notification";

notification.prototype.events = {}

notification.prototype.info = function () {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

notification.prototype.load = function (communication) {
  this.communication = communication;

  this.start();
};

notification.prototype.unload = function () {
  this.stop();
};

notification.prototype.start = function () {

  utils.startListening.bind(this)({
    'person:employee:nearby': this._onEmployeeNearby.bind(this),
    'person:employee:faraway': this._onEmployeeFaraway.bind(this),
    'person:employee:online': this._onEmployeeOnline.bind(this),
    'person:employee:offline': this._onEmployeeOffline.bind(this)
  });

  this.communication.emit('synchronization:outgoing:quickshot:register', {
    companyResource: 'notifications',
    registerEvents: ['person:device:discover:create'],
    outgoingFunction: this._onDeviceDiscoverCreate
  });
};

notification.prototype.stop = function () {
  utils.stopListening.bind(this)([
    'person:employee:nearby',
    'person:employee:faraway',
    'person:employee:online',
    'person:employee:offline'
  ]);
};

notification.prototype._onEmployeeNearby = function (employee) {
  logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is nearby');
};

notification.prototype._onEmployeeFaraway = function (employee) {
  logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is faraway');
};

notification.prototype._onEmployeeOnline = function (employee) {
};

notification.prototype._onEmployeeOffline = function (employee) {
};

notification.prototype._onDeviceDiscoverCreate = function (device, callback) {
  if (device) {
    // we just discovered a new device

    var notification = {
      created_date: moment(),
      app: 'presence',
      module: 'device',
      device: device.id,
      message: 'Discovered device ' + device.name
    };

    callback(null, notification);
  }
};

var instance = new notification();

module.exports = instance;
