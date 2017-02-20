/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const UnknownIntentError = require('../nlp/errors/unknown-intent-error')

const Bot = require('../../bot')

const Locale = require('../../utils/locale')

class IOModule extends Module {
  constructor (name) {
    super('io', name)
  }

  _onVoiceInput (voice) {
    return Bot.emitAsync('nlp:intent:speech', voice)
      .then(({ event, params }) => {
        if (params.text) {
          return params.text
        }

        if (event) {
          return Bot.emitAsync(event, params)
            .then((text) => text)
        }
      })
      .catch(UnknownIntentError, () => Locale.get('unable_to_understand'))
  }

  _onTextInput (text) {
    return Bot.emitAsync('nlp:intent:text', text)
      .then(({ event, params }) => {
        if (params.text) {
          return params.text
        }

        if (event) {
          return Bot.emitAsync(event, params)
            .then((text) => text)
        }
      })
      .catch(UnknownIntentError, () => Locale.get('unable_to_understand'))
  }
}

module.exports = IOModule
