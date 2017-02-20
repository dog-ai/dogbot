/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')

const Bot = require('../bot')

module.exports = {

  startListening: function (events) {
    var _this = this

    _.forEach(events, function (fn, event) {
      Bot.on(event, fn)
      _.extend(_this.events, events)
    })
  },

  stopListening: function (events) {
    var _this = this

    _.forEach(events, function (event) {
      Bot.removeListener(event, _this.events[ event ])
      delete _this.events[ event ]
    })
  }
}
