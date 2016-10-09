/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class LinkedIn extends App {
  constructor () {
    super('linkedin', [], [
      { type: 'social', name: 'linkedin' }
    ])
  }
}

module.exports = new LinkedIn()
