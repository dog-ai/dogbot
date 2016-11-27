/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const NLPModule = require('./nlp-module')

const Promise = require('bluebird')

const { retry } = require('../../utils')

const { UnknownIntentError } = require('./errors')

const wit = Promise.promisifyAll(require('node-wit'))

const extractSpeechIntent = function (speech, callback) {
  retry(() => wit.captureSpeechIntentAsync(this._apiToken, speech, 'audio/wav'), {
    max_tries: 3,
    interval: 500
  })
    .then(({ _text }) => {
      if (_text === '') {
        callback(new UnknownIntentError())
      }

      callback(null, { params: { text: _text } })
    })
    .catch(callback)
}

class Wit extends NLPModule {
  constructor () {
    super('wit')
  }

  load (communication, config) { // TODO: remove communication
    this._apiToken = config && config.wit && config.wit.api_token

    if (!this._apiToken) {
      throw new Error('invalid configuration: no api token available')
    }

    super.load()
  }

  start () {
    super.start({
      'nlp:intent:speech': extractSpeechIntent.bind(this)
    })
  }
}

module.exports = new Wit()
