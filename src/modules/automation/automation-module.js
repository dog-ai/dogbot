/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

class AutomationModule extends Module {
  constructor (name) {
    super('automation', name)
  }
}

module.exports = AutomationModule
