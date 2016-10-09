/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const NLPModule = require('./nlp-module')

const _ = require('lodash')
const Promise = require('bluebird')
const retry = require('bluebird-retry')

const { UnknownIntentError } = require('./errors')

const wit = Promise.promisifyAll(require('node-wit'))

class Wit extends NLPModule {
  constructor () {
    super('wit')
  }

  load (communication, config) { // TODO: remove communication
    this._apiToken = config && config.api_token

    if (!this._apiToken) {
      throw new Error('invalid configuration: no api token available')
    }

    super.load()
  }

  start () {
    super.start({
      'nlp:intent:text': this._extractTextIntent.bind(this)
    })
  }

  _extractTextIntent (text, callback) {
    retry(() => wit.captureTextIntentAsync(this._apiToken, text), { max_tries: 3, interval: 500 })
      .then((response) => {
        const outcome = _.head(_.sortBy(response.outcomes, [ 'confidence' ]))

        if (outcome.intent === 'UNKNOWN' || outcome.confidence < 0.8) {
          return callback(new UnknownIntentError())
        }

        const event = outcome.metadata
        const params = outcome.entities

        callback(null, { event, params })
      })
      .catch(callback)
  }
}

module.exports = new Wit()
