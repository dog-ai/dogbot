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
    'person:employee:faraway': this._onEmployeeFaraway.bind(this)
  });

  this.communication.emit('sync:outgoing:quickshot:register', {
    companyResource: 'notifications',
    registerEvents: ['person:device:discover:create'],
    outgoingFunction: this._onDeviceDiscoverCreate
  });
};

notification.prototype.stop = function () {

  utils.stopListening.bind(this)([
    'person:employee:nearby',
    'person:employee:faraway'
  ]);
};

notification.prototype._onEmployeeNearby = function (employee) {
  logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is nearby');
};

notification.prototype._onEmployeeFaraway = function (employee) {
  logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is faraway');
};

notification.prototype._onDeviceDiscoverCreate = function (device, callback) {
  logger.info('Discovered device ' + device.name);

  var notification = {
    id: instance._generatePushID(),
    created_date: moment(),
    app: 'presence',
    module: 'device',
    device: device.id,
    message: 'Discovered device ' + device.name
  };

  callback(null, notification);
};

notification.prototype._generatePushID = (function () {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

  // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
  var lastPushTime = 0;

  // We generate 72-bits of randomness which get turned into 12 characters and appended to the
  // timestamp to prevent collisions with other clients.  We store the last characters we
  // generated because in the event of a collision, we'll use those same characters except
  // "incremented" by one.
  var lastRandChars = [];

  return function () {
    var now = new Date().getTime();
    var duplicateTime = (now === lastPushTime);
    lastPushTime = now;

    var timeStampChars = new Array(8);
    for (var i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64);
    }
    if (now !== 0) throw new Error('We should have converted the entire timestamp.');

    var id = timeStampChars.join('');

    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[i] = Math.floor(Math.random() * 64);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
        lastRandChars[i] = 0;
      }
      lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if (id.length != 20) throw new Error('Length should be 20.');

    return id;
  };
})();

var instance = new notification();

module.exports = instance;
