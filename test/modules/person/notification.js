/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var Notification, communication

describe('Notification', function () {
  before(function () {
  })

  beforeEach(function () {
    Notification = require(SRC_PATH + 'modules/person/notification')
    communication = require(SRC_PATH + 'utils/communication')
  })

  afterEach(function () {
    delete require.cache[require.resolve(SRC_PATH + 'utils/communication')];
    delete require.cache[require.resolve(SRC_PATH + 'modules/person/notification')]
  })

  after(function () {
  })

  describe('#load()', function () {
    it('should start listening to events', function () {

      Notification.load(communication)

      expect(communication._eventsCount).to.be.above(0)
    })
  })

  describe('#unload()', function () {
    it('should stop listening to events', function () {

      Notification.load(communication)
      Notification.unload()

      expect(communication._eventsCount).to.equal(0)
    })
  })
})