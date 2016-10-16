/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const stream = new require('stream')
const path = require('path')

let target

let Communication

describe('TTS', () => {
  describe('Google', () => {
    before(() => {
      Communication = require('../../../src/utils/communication')
    })

    beforeEach(() => {
      target = require(path.join(__dirname, '/../../../src/modules/tts/google'))

      target.load()
    })

    after(() => {
      delete require.cache[ require.resolve(path.join(__dirname, '/../../../src/utils/communication')) ]
    })

    afterEach(() => {
      if (target) {
        target.unload()
      }

      delete require.cache[ require.resolve(path.join(__dirname, '/../../../src/modules/tts/google')) ]
    })

    describe('^tts:stream', () => {
      it('should return speech stream', () => {
        return Communication.emitAsync('tts:stream', { text: 'Hello world!' })
          .should.be.fulfilled
      })
    })
  })
})