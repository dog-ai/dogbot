/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const UnknownIntentError = require('../nlp/errors/unknown-intent-error')

const Locale = require('../../utils/locale')
const Logger = require('../../utils/logger')
const Communication = require('../../utils/communication')

class IOModule extends Module {
  constructor (name) {
    super('io', name)
  }

  _onTextMessage (text) {
    return Communication.emitAsync('nlp:intent:text', text)
      .timeout(5000)
      .then(({ event, params }) => {
        if (params.text) {
          return resolve(params.text)
        }

        return Communication.emitAsync(event, params)
          .then((text) => text)
      })
      .catch(UnknownIntentError, () => Locale.get('unable_to_understand'))
      .catch((error) => {
        Logger.error(error)

        throw error
      })
  }
}

module.exports = IOModule
