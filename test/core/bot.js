/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe.skip('Worker', () => {
  let subject
  let Server
  let Logger
  let sync
  let worker
  let heartbeat

  beforeEach(() => {
    sync = td.object()
    worker = td.object()
    heartbeat = td.object()

    Logger = td.replace(require('../../src/utils'), 'Logger', td.object([ 'error', 'info' ]))
    td.replace(require('../../src/core/sync'), 'Sync', function () { return sync })
    td.replace('../../src/core/worker', function () { return worker })
    td.replace('../../src/core/heartbeat', function () { return heartbeat })

    Server = require('../../src/server').Server
  })

  afterEach(() => {
    td.reset()
  })

  context('when starting with valid secret', () => {
    let secret = 'my-secret'

    beforeEach(() => {
      subject = new Server()
    })

    it('should start sync with secret', () => {
      td.when(worker.start()).thenResolve()

      return subject.start(secret)
        .then(() => {
          td.verify(sync.start(secret))
        })
    })

    it('should start sync and worker', () => {
      td.when(worker.start()).thenResolve()

      return subject.start(secret)
        .then(() => {
          td.verify(sync.start(), { times: 1, ignoreExtraArgs: true })
          td.verify(worker.start(), { times: 1 })
        })
    })
  })

  context('when starting with invalid secret', () => {
    let secret

    beforeEach(() => {
      subject = new Server()
    })

    it('should fail with invalid secret', () => {
      const result = subject.start(secret)

      return result.should.eventually.be.rejectedWith('invalid secret')
    })
  })

  context('when stopping after being started', () => {
    beforeEach(() => {
      td.when(worker.start()).thenResolve()

      const secret = 'my-secret'
      subject = new Server()
      subject.start(secret)
    })

    it('should stop sync, worker and heartbeat', () => {
      td.when(sync.stop()).thenResolve()
      td.when(worker.stop()).thenResolve()
      td.when(heartbeat.stop()).thenResolve()

      return subject.stop()
        .then(() => {
          td.verify(sync.stop())
          td.verify(worker.stop())
          td.verify(heartbeat.stop())
        })
    })
  })
})
