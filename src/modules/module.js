/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')

const Server = require('../server')

class Module {
  constructor (type, name) {
    this.type = type
    this.name = name
    this.events = {}
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

  start (events) {
    if (events) {
      this.events = events

      this._startListening(events)
    }
  }

  stop () {
    this._stopListening()
  }

  _startListening (events = {}) {
    _.forEach(events, (fn, event) => Server.on(event, fn))
  }

  _stopListening () {
    if (!this.events || this.events === {}) {
      return
    }

    _.forEach(this.events, (fn, event) => {
      Server.removeListener(event, fn)
      delete this.events[ event ]
    })
  }
}

module.exports = Module
