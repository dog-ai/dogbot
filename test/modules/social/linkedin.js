/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var LinkedIn, communication

describe('LinkedIn', function () {
  before(function () {
  })

  beforeEach(function () {
    LinkedIn = require(SRC_PATH + 'modules/social/linkedin')
    communication = require(SRC_PATH + 'utils/communication')
  })

  afterEach(function () {
    delete require.cache[require.resolve(SRC_PATH + 'utils/communication')];
    delete require.cache[require.resolve(SRC_PATH + 'modules/social/linkedin')]
  })

  after(function () {
  })

  describe('#load()', function () {
    it('should start listening to events', function () {

      LinkedIn.load(communication)

      expect(communication._eventsCount).to.be.above(0)
    })
  })

  describe('#unload()', function () {
    it('should stop listening to events', function () {

      LinkedIn.load(communication)
      LinkedIn.unload()

      expect(communication._eventsCount).to.equal(0)
    })
  })
})