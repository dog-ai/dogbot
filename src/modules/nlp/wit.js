/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const NLPModule = require('./nlp-module')

const _ = require('lodash')
const Promise = require('bluebird')

const { LowConfidenceError, UnknownIntentError } = require('./errors')

const wit = Promise.promisifyAll(require('node-wit'))

class Wit extends NLPModule {
  constructor () {
    super('wit')
  }

  load (communication, config) { // TODO: remove communication
    super.load({
      'nlp:intent:text': this._extractTextIntent.bind(this)
    })

    this._apiToken = config && config.api_token

    if (!this._apiToken) {
      throw new Error('invalid configuration: no api token available')
    }
  }

  _extractTextIntent (text, callback) {
    wit.captureTextIntentAsync(this._apiToken, text)
      .then((response) => {
        const outcome = _.head(_.sortBy(response.outcomes, [ 'confidence' ]))

        if (outcome.intent === 'UNKNOWN') {
          return callback(new UnknownIntentError())
        }

        if (outcome.confidence < 0.8) {
          return callback(new LowConfidenceError(outcome.confidence))
        }

        callback(null, { event: outcome.metadata, entities: outcome.entities })
      })
      .catch(callback)
  }
}

module.exports = new Wit()
