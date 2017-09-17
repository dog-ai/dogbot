/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe('Greenkeeper', () => {
  let subject
  let AutomationModule
  let Server
  let Logger
  let GitHubWrapper

  before(() => {
    AutomationModule = td.object()

    Server = td.object([ 'on', 'enqueueJob', 'dequeueJob', 'removeListener' ])

    Logger = td.object()

    GitHubWrapper = td.constructor([ 'mergeGreenkeeperPullRequests' ])
  })

  afterEach(() => td.reset())

  describe('when constructing', () => {
    beforeEach(() => {
      td.replace('../../../src/server', Server)

      subject = require('../../../src/modules/automation/greenkeeper')
    })

    it('should set name as greenkeeper', () => {
      subject.name.should.be.equal('greenkeeper')
    })
  })

  describe('when loading', () => {
    const api_token = 'my-api-token'
    const merge_owner = 'my-merge-owner'
    const greenkeeper = { merge_owner }
    const options = { api_token, greenkeeper }

    beforeEach(() => {
      td.replace('../../../src/modules/automation/automation-module.js')

      td.replace('../../../src/server', Server)

      td.replace('@dog-ai/github-wrapper', GitHubWrapper)

      subject = require('../../../src/modules/automation/greenkeeper')
      subject.load(options)
    })

    it('should instantiate new github wrapper', () => {
      subject.wrapper.should.not.be.null
    })
  })

  describe('when starting', () => {
    beforeEach(() => {
      td.replace('../../../src/modules/automation/automation-module.js')

      td.replace('../../../src/server', Server)

      subject = require('../../../src/modules/automation/greenkeeper')
      subject.start()
    })

    it('should enqueue greenkeeper merge job every 30 minutes', () => {
      td.verify(Server.enqueueJob('automation:greenkeeper:merge', null, { schedule: '30 minutes' }), { times: 1 })
    })
  })

  describe('when stopping', () => {
    beforeEach(() => {
      td.replace('../../../src/modules/automation/automation-module.js')

      td.replace('../../../src/server', Server)

      subject = require('../../../src/modules/automation/greenkeeper')
      subject.stop()
    })

    it('should dequeue greenkeeper merge job', () => {
      td.verify(Server.dequeueJob('automation:greenkeeper:merge'), { times: 1 })
    })
  })

  describe('when triggering greenkeeper merge job', () => {
    const api_token = 'my-api-token'
    const merge_owner = 'my-merge-owner'
    const greenkeeper = { merge_owner }
    const options = { api_token, greenkeeper }
    let eventFn
    const params = {}
    let callback = td.function()

    beforeEach(() => {
      td.replace('../../../src/modules/automation/automation-module.js')

      td.replace('../../../src/server', Server)
      td.when(Server.on('automation:greenkeeper:merge'), { ignoreExtraArgs: true })
        .thenDo((event, fn) => {
          eventFn = fn
        })

      td.replace('@dog-ai/github-wrapper', GitHubWrapper)
      td.when(GitHubWrapper.prototype.mergeGreenkeeperPullRequests(), { ignoreExtraArgs: true })
        .thenResolve()

      subject = require('../../../src/modules/automation/greenkeeper')
      subject.load(options)
      subject.start()
      return eventFn(params, callback)
    })

    afterEach(() => subject.stop())

    it('should merge greenkeeper pull requests from owner', () => {
      td.verify(GitHubWrapper.prototype.mergeGreenkeeperPullRequests(merge_owner), { times: 1 })
    })

    it('should callback', () => {
      td.verify(callback(), { times: 1 })
    })
  })
})
