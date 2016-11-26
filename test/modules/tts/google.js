/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe('Google Text-to-Speech', () => {
  let subject
  let Communication

  before(() => {
    Communication = require('../../../src/utils/communication')
  })

  beforeEach(() => {
    subject = require('../../../src/modules/tts/google')

    subject.load()
  })

  after(() => {
    delete require.cache[ require.resolve('../../../src/utils/communication') ]
  })

  afterEach(() => {
    if (subject) {
      subject.unload()
    }

    delete require.cache[ require.resolve('../../../src/modules/tts/google') ]
  })

  describe('^tts:stream', () => {
    it('should return speech stream', () => {
      return Communication.emitAsync('tts:stream', { text: 'Hello world!' })
        .should.be.fulfilled
    })
  })
})
