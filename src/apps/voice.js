/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class Assistant extends App {
  constructor () {
    super('voice', [], [
      { type: 'io', name: 'voice' },
      { type: 'nlp', name: 'api' },
      { type: 'nlp', name: 'wit' },
      { type: 'tts', name: 'google' }
    ])
  }
}

module.exports = new Assistant()
