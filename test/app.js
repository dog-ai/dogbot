/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Bot = td.replace('../src/bot', function () {
  return {
    start: td.function(),
    stop: td.function()
  }
})
//const Logger = td.replace(require('../src/utils'), 'Logger', td.object({ error: td.function() }))

let subject

describe('Application', () => {
  afterEach(() => {
    td.reset()

    delete require.cache[ require.resolve('../src/app') ]
  })

  it('should start bot', () => {
    td.when(Bot.start()).thenResolve()

    subject = require('../src/app')

    td.verify(Bot.start())
  })
})
