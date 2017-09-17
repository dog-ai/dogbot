/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')

const Server = require('../server')

const startListening = (events) => {
  _.forEach(events, (fn, event) => Server.on(event, fn))
}

const stopListening = () => {
  if (!this._events || this._events === {}) {
    return
  }

  _.forEach(this._events, (fn, event) => {
    Server.removeListener(event, fn)

    delete this._events[ event ]
  })
}

class Listener {
  constructor () {
    this._events = {}
  }

  get events () {
    return this._events
  }

  start (events = {}) {
    startListening.bind(this)(events)
  }

  stop () {
    stopListening.bind(this)()
  }
}

module.exports = Listener
