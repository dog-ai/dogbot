/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

describe('App Manager', () => {
  let subject

  before(() => {
    td.replace('../../../src/utils/logger', td.object())
  })

  beforeEach(() => {
    subject = require('../../../src/bot/apps').AppManager
  })

  afterEach(() => {
    td.reset()

    delete require.cache[ require.resolve('../../../src/bot/apps') ]
  })

  describe('#enableApp()', () => {
    it('should enable dummy app', () => {
      const id = 'dummy'

      const result = subject.enableApp(id)

      return result.should.eventually.be.fulfilled
    })

    it('should fail to enable app not available', () => {
      const id = 'not-available-app'

      const result = subject.enableApp(id)

      return result.should.eventually.be.rejected
    })
  })

  describe('#disableApp()', () => {
    it('should disable dummy app', () => {
      const id = 'dummy'

      const result = subject.enableApp(id)
        .then(() => subject.disableApp(id))

      return result.should.eventually.be.fulfilled
    })

    it('should fail to disable app already disabled', () => {
      const id = 'dummy'

      const result = subject.disableApp(id)

      return result.should.eventually.be.rejected
    })
  })

  describe('#disableAllApps()', () => {
    it('should disable all apps', () => {
      const id = 'dummy'

      const result = subject.enableApp(id)
        .then(() => subject.disableAllApps())

      return result.should.eventually.be.fulfilled
    })
  })

  describe('#healthCheck()', () => {
    it('should be healthy', () => {
      const result = subject.healthCheck()

      return result.should.eventually.be.fulfilled
    })
  })
})
