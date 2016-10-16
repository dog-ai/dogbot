/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const Promise = require('bluebird')
const retry = require('bluebird-retry')

const request = Promise.promisifyAll(require('request'))

const client = require('google-tts-api')

class Google extends Module {
  constructor () {
    super('tts', 'google')
  }

  start () {
    super.start({
      'tts:stream': this._stream.bind(this)
    })
  }

  _stream ({ text, language = 'en' }, callback) {
    if (!text) {
      return callback(new Error())
    }

    client(text, language, 1, 10000)
      .then((url) => {
        if (!url) {
          return callback(new Error())
        }

        return retry(() => request(url), { max_tries: 3, interval: 500, timeout: 5000 })
      })
      .then((stream) => callback(null, stream))
      .catch(callback)
  }
}

module.exports = new Google()
