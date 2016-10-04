/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')

const Communication = require('../utils/communication')

module.exports = {

  startListening: (events) => {
    var _this = this

    _.forEach(events, function (fn, event) {
      Communication.on(event, fn)
      _.extend(_this.events, events)
    })
  },

  stopListening: function (events) {
    var _this = this

    _.forEach(events, function (event) {
      Communication.removeListener(event, _this.events[ event ])
      delete _this.events[ event ]
    })
  }
}
