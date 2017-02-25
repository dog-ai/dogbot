/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

module.exports = function AppNotAvailableError (message) {
  Error.captureStackTrace(this, this.constructor)

  this.name = this.constructor.name
  this.message = message
}

require('util').inherits(module.exports, Error)
