/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class GitHub extends App {
  constructor () {
    super('github', [], [
      { type: 'automation', name: 'greenkeeper', optional: true }
    ])
  }
}

module.exports = new GitHub()
