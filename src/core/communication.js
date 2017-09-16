/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const EventEmitter = require('events').EventEmitter

class Communication extends EventEmitter {
  constructor () {
    super()

    Communication.prototype.emitAsync = Promise.promisify(EventEmitter.prototype.emit)

    this.setMaxListeners(256)
  }
}

module.exports = new Communication()
