/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')

const Communication = require('../utils/communication')

class Module {
  constructor (type, name) {
    this.type = type
    this.name = name
  }

  info () {
    return '*' + this.name + '* - ' +
      '_' + this.name.toUpperCase() + ' ' +
      this.type.toLowerCase() + ' module_'
  }

  load () {
    this.start()
  }

  unload () {
    this.stop()
  }

  _startListening (events) {
    _.forEach(events, (fn, event) => {
      Communication.on(event, fn)
      _.extend(this.events, events)
    })
  }

  _stopListening (events) {
    _.forEach(events, (event) => {
      Communication.removeListener(event, this.events[ event ])
      delete this.events[ event ]
    })
  }
}

module.exports = Module
