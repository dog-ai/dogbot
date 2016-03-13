/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var Slack, communication

describe('Slack', function () {
  before(function () {
  })

  beforeEach(function () {
    Slack = require(SRC_PATH + 'modules/io/slack')
    communication = require(SRC_PATH + 'utils/communication')
  })

  afterEach(function () {
    delete require.cache[require.resolve(SRC_PATH + 'modules/io/slack')]
    delete require.cache[require.resolve(SRC_PATH + 'utils/communication')];
  })

  after(function () {
  })

  describe('#load()', function () {
    it('should start listening to events', function () {

      Slack.load(communication)

      expect(communication._eventsCount).to.be.above(0)

    })
  })

  describe('#unload()', function () {
    it('should stop listening to events', function () {
      Slack.load(communication)
      Slack.unload()

      expect(communication._eventsCount).to.equal(0)
    })
  })
})