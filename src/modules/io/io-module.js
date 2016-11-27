/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const UnknownIntentError = require('../nlp/errors/unknown-intent-error')

const Locale = require('../../utils/locale')
const Communication = require('../../utils/communication')

class IOModule extends Module {
  constructor (name) {
    super('io', name)
  }

  _onVoiceInput (voice) {
    return Communication.emitAsync('nlp:intent:speech', voice)
      .then(({ event, params }) => {
        if (params.text) {
          return params.text
        }

        if (event) {
          return Communication.emitAsync(event, params)
            .then((text) => text)
        }
      })
      .catch(UnknownIntentError, () => Locale.get('unable_to_understand'))
  }

  _onTextInput (text) {
    return Communication.emitAsync('nlp:intent:text', text)
      .then(({ event, params }) => {
        if (params.text) {
          return params.text
        }

        if (event) {
          return Communication.emitAsync(event, params)
            .then((text) => text)
        }
      })
      .catch(UnknownIntentError, () => Locale.get('unable_to_understand'))
  }
}

module.exports = IOModule
