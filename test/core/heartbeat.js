/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe('Heartbeat', () => {
  let subject
  let Worker
  let Communication

  afterEach(() => td.reset())

  context('when already started', () => {
    const interval = 1
    const heartbeat = () => {}
    const healthCheck = Promise.resolve

    before(() => {
      Worker = td.replace('../../src/core/worker', td.object([ 'enqueueJob', 'dequeueJob' ]))
      Communication = td.replace(require('../../src/utils'), 'Communication', td.object([ 'on', 'emit' ]))

      subject = require('../../src/core/heartbeat')

      return subject.start(interval, heartbeat, healthCheck)
    })

    after(() => {
      delete require.cache[ require.resolve('../../src/core/heartbeat') ]
    })

    it('should throw already started error', () => {
      return subject.start(interval, heartbeat, healthCheck)
        .catch((error) => {
          error.message.should.be.equal('already started')
        })
    })
  })

  context('when starting', () => {
    const interval = 1
    const heartbeat = () => {}
    const healthCheck = Promise.resolve

    beforeEach(() => {
      Worker = td.replace('../../src/core/worker', td.object([ 'enqueueJob', 'dequeueJob' ]))
      Communication = td.replace(require('../../src/utils'), 'Communication', td.object([ 'on', 'emit' ]))

      subject = require('../../src/core/heartbeat')
    })

    afterEach(() => {
      delete require.cache[ require.resolve('../../src/core/heartbeat') ]
    })

    it('should return heartbeat interval', () => {
      return subject.start(interval, heartbeat, healthCheck)
        .then((result) => {
          result.should.be.equal(interval / 2)
        })
    })

    it('should enqueue heartbeat job with schedule 0.5 seconds', () => {
      subject.start(interval, heartbeat, healthCheck)

      td.verify(Worker.enqueueJob('bot:heartbeat', null, { schedule: '0.5 seconds' }), { times: 1 })
    })
  })

  context('when starting with an invalid interval', () => {
    const interval = 0
    const heartbeat = () => {}
    const healthCheck = Promise.resolve

    beforeEach(() => {
      Worker = td.replace('../../src/core/worker', td.object([ 'enqueueJob', 'dequeueJob' ]))
      Communication = td.replace(require('../../src/utils'), 'Communication', td.object([ 'on', 'emit' ]))

      subject = require('../../src/core/heartbeat')
    })

    afterEach(() => {
      delete require.cache[ require.resolve('../../src/core/heartbeat') ]
    })

    it('should throw invalid interval error', () => {
      return subject.start(interval, heartbeat, healthCheck)
        .catch((error) => {
          error.message.should.be.equal('invalid interval')
        })
    })
  })

  context('when stopping', () => {
    beforeEach(() => {
      Worker = td.replace('../../src/core/worker', td.object([ 'enqueueJob', 'dequeueJob' ]))
      Communication = td.replace(require('../../src/utils'), 'Communication', td.object([ 'on', 'emit' ]))

      subject = require('../../src/core/heartbeat')

      subject.start(1, () => {}, Promise.resolve)
    })

    afterEach(() => {
      delete require.cache[ require.resolve('../../src/core/heartbeat') ]
    })

    it('should dequeue heartbeat job', () => {
      subject.stop()

      td.verify(Worker.dequeueJob('bot:heartbeat'), { times: 1 })
    })
  })
})
