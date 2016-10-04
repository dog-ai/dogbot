/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

class PersonModule extends Module {
  constructor (name) {
    super('person', name)
  }
}

module.exports = PersonModule
