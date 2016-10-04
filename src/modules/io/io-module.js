/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

class IOModule extends Module {
  constructor (name) {
    super('io', name)

    this.events = {}
  }
}

module.exports = IOModule
