/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const { Locale } = require('../../utils')

const readline = require('readline')

class stdin extends IOModule {
  constructor () {
    super('stdin')
  }

  start () {
    this._interface = readline.createInterface({ input: process.stdin, terminal: false })

    this._interface.on('line', this._onLine.bind(this))

    super.start()
  }

  stop () {
    if (this._interface) {
      this._interface.close()
    }

    super.stop()
  }

  _onLine (text) {
    super._onTextInput(text)
      .then((reply) => console.log(reply))
      .catch(() => {
        const reply = Locale.get('error')

        console.log(reply)
      })
  }
}

// eslint-disable-next-line new-cap
module.exports = new stdin()
