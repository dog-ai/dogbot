/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

let AppManager

describe('App Manager', () => {
  let subject

  beforeEach(() => {
    td.replace('../../src/databases', td.object())
    td.replace('../../src/modules', td.object())
    td.replace(require('../../src/utils'), 'Logger', td.object([ 'error', 'info' ]))
    AppManager = require('../../src/apps').AppManager
  })

  afterEach(() => {
    td.reset()

    delete require.cache[ require.resolve('../../src/apps') ]
  })

  context('when app not available', () => {
    beforeEach(() => {
      subject = new AppManager()
    })

    it('should fail to enable', () => {
      const id = 'not-available-app'

      const result = subject.enableApp(id)

      return result.should.eventually.be.rejected
    })
  })

  context('when app available', () => {
    beforeEach(() => {
      subject = new AppManager()
    })

    it('should enable', () => {
      const id = 'dummy'

      const result = subject.enableApp(id)

      return result.should.eventually.be.fulfilled
    })
  })

  context('when app already disabled', () => {
    const id = 'dummy'

    beforeEach(() => {
      subject = new AppManager()
    })

    it('should fail to disable', () => {
      const result = subject.disableApp(id)

      return result.should.eventually.be.rejected
    })
  })

  context('when app already enabled', () => {
    const id = 'dummy'

    beforeEach(() => {
      subject = new AppManager

      return subject.enableApp(id)
    })

    it('should disable', () => {
      const result = subject.disableApp(id)

      return result.should.eventually.be.fulfilled
    })

    it('should disable all apps', () => {
      const result = subject.disableAllApps()

      return result.should.eventually.be.fulfilled
    })
  })
})