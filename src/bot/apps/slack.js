/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class Slack extends App {
  constructor () {
    super('slack', [], [
      { type: 'io', name: 'slack' }
    ])
  }
}

module.exports = new Slack()
