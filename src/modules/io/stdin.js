/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Locale = require('../../utils/locale')

const readline = require('readline')

class STDIn extends IOModule {
  constructor () {
    super('stdin')
  }

  start () {
    super.start()

    this._interface = readline.createInterface({ input: process.stdin, terminal: false })

    this._interface.on('line', (text) => {
      super._onTextInput(text)
        .then((reply) => console.log(reply))
        .catch(() => {
          const reply = Locale.get('error')

          console.log(reply)
        })
    })
  }

  stop () {
    if (this._interface) {
      this._interface.close()
    }

    super.stop()
  }
}

module.exports = new STDIn()
