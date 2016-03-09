/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var _ = require('lodash');

module.exports = {

  startListening: function (events) {
    var _this = this;

    _.forEach(events, function (fn, event) {
      _this.communication.on(event, fn);
      _.extend(_this.events, events);
    });
  },

  stopListening: function (events) {
    var _this = this;

    _.forEach(events, function (event) {
      _this.communication.removeListener(event, _this.events[event]);
      delete _this.events[event];
    });
  }
}