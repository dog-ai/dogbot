/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class Dummy extends App {
  constructor () {
    super('dummy', [], [])
  }
}

module.exports = new Dummy()

