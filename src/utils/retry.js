/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const retry = require('bluebird-retry')

const timeoutPredicate = (error) => error.code && error.code === 'ETIMEDOUT'

module.exports = function (fn, options = { max_tries: 3, interval: 500 }) {
  return retry(fn, options)
    .catch(timeoutPredicate, (error) => {
      throw error.failure
    })
}
