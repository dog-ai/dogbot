/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class Brain extends App {
  constructor () {
    super('brain', [], [
      { type: 'nlp', name: 'api' },
      { type: 'action', name: 'slap' },
      { type: 'email', name: 'sendgrid' },
      { type: 'user', name: 'invite' }
    ])
  }
}

module.exports = new Brain()
