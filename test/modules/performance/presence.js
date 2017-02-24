/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe('Presence', () => {
  let subject
  let Bot

  before(() => {
    Bot = td.object([ 'enqueueJob', 'dequeueJob', 'on', 'removeListener', 'emit' ])
  })

  afterEach(() => td.reset())

  context('when starting', () => {
    beforeEach(() => {
      td.replace('../../../src/bot', Bot)

      subject = require('../../../src/modules/performance/presence')
    })

    afterEach(() => {
      delete require.cache[ require.resolve('../../../src/modules/performance/presence') ]
    })

    it('should enqueue a performance presence stats update job for every 6 hours', () => {
      subject.start()

      td.verify(Bot.enqueueJob('performance:presence:stats:update', null, { schedule: '6 hours' }), { times: 1 })
    })
  })

  context('when stopping', () => {
    beforeEach(() => {
      td.replace('../../../src/bot', Bot)

      subject = require('../../../src/modules/performance/presence')

      subject.start()
    })

    afterEach(() => {
      delete require.cache[ require.resolve('../../../src/modules/performance/presence') ]
    })

    it('should dequeue performance presence stats update job', () => {
      subject.stop()

      td.verify(Bot.dequeueJob('performance:presence:stats:update'), { times: 1 })
    })
  })
})
