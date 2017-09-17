/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

let AppManager

describe('App Manager', () => {
  let subject

  beforeEach(() => {
    td.replace('../../src/databases', td.object())
    td.replace('../../src/modules', td.object())
    td.replace(require('../../src/utils'), 'Logger', td.object([ 'error', 'info' ]))
    AppManager = require('../../src/core/app-manager')
  })

  afterEach(() => {
    td.reset()

    delete require.cache[ require.resolve('../../src/core/app-manager') ]
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
})
