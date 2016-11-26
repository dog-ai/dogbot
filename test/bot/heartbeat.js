/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

describe('Heartbeat', () => {
  let subject
  let Communication

  beforeEach(() => {
    Communication = td.replace(require('../../src/utils'), 'Communication', td.object([ 'on', 'emit' ]))
    Heartbeat = require('../../src/bot/heartbeat')
  })

  afterEach(() => {
    td.reset()
  })

  context('when already started', () => {
    beforeEach(() => {
      subject = new Heartbeat()

      return subject.start(1, () => {}, Promise.resolve)
    })

    it('should fail to start again', () => {
      (() => subject.start(1, () => {}, Promise.resolve))
        .should.throw('already started')
    })
  })

  context('when starting', () => {
    beforeEach(() => {
      subject = new Heartbeat()
    })

    it('should fail with interval lower than or equal to zero', () => {
      (() => subject.start(0, () => {}, Promise.resolve))
        .should.throw('invalid interval')
    })

    it('should return heartbeat interval', () => {
      const result = subject.start(2, () => {}, Promise.resolve)

      return result.should.be.equal(1)
    })
  })
})
