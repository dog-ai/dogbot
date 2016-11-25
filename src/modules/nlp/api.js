/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const NLPModule = require('./nlp-module')

const Promise = require('bluebird')
const retry = require('bluebird-retry')

const { UnknownIntentError } = require('./errors')

const Apiai = require('apiai')

const responseHandler = ({ result: { action, metadata, fulfillment: { speech } } }, callback) => {
  let event = action
  const params = metadata
  params.text = speech

  if (action === 'unable_to_understand') {
    return callback(new UnknownIntentError(), { params })
  }

  if (/^\w+\.\w+$/.test(action)) { // api.ai domains that return text (i.e. smalltalk.person)
    event = 'io:text'
  }

  return callback(null, { event, params })
}

class Api extends NLPModule {
  constructor () {
    super('api')
  }

  load (communication, config) { // TODO: remove communication
    this._apiToken = config && config.api && config.api.api_token

    if (!this._apiToken) {
      throw new Error('invalid configuration: no api token available')
    }

    super.load()
  }

  start () {
    super.start({
      'nlp:intent:text': this._extractTextIntent.bind(this)
    })

    this._client = new Apiai(this._apiToken)
  }

  _extractTextIntent (text, callback) {
    return retry(() => new Promise((resolve, reject) => {
      const request = this._client.textRequest(text, { sessionId: '94296bfa-b336-11e6-80f5-76304dec7eb7' })
      request.on('response', (response) => resolve(response))
      request.on('error', reject)

      request.end()
    }), { max_tries: 3, interval: 500 })
      .then((response) => responseHandler(response, callback))
      .catch(callback)
  }
}

module.exports = new Api()
