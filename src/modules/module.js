/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Listener = require('../utils/listener')

class Module extends Listener {
  constructor (type, name) {
    super()

    this._type = type
    this._name = name
  }

  get type () {
    return this._type
  }

  get name () {
    return this._name
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

  start (events = {}) {
    super.start(events)
  }

  stop () {
    super.stop()
  }
}

module.exports = Module
