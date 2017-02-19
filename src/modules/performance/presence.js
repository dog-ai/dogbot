/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PerformanceModule = require('./performance-module')

const Bot = require('../../bot')

const enqueueStatsUpdateTask = (params, callback) => {
  const companyId = Bot.getCompanyId()

  if (!companyId) {
    callback()
  }

  Bot.enqueueTask('performance:presence:stats:update', [ companyId ])
    .then(() => callback())
    .catch((error) => callback(error))
}

class Presence extends PerformanceModule {
  constructor () {
    super('presence')
  }

  start () {
    super.start({ 'performance:presence:stats:update': enqueueStatsUpdateTask })

    const options = { schedule: '1 minute' }
    Bot.enqueueJob('performance:presence:stats:update', null, options)
  }

  stop () {
    Bot.dequeueJob('performance:presence:stats:update')

    super.stop()
  }
}

module.exports = new Presence()
