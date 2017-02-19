/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const { Logger } = require('../utils')

const Sync = require('./sync')
const Worker = require('./worker')
const Heartbeat = require('./heartbeat')

class Bot {
  start (secret) {
    if (!secret) {
      return Promise.reject(new Error('invalid secret'))
    }

    return Worker.start()
      .then(() => {
        // unchain so we don't get blocked by not having an internet connection
        Sync.start(secret)
          .catch(Logger.error)
      })
      .catch(Logger.error)
  }

  stop () {
    return Sync.stop()
      .then(() => Worker.stop())
      .then(() => Heartbeat.stop())
      .catch(Logger.error)
  }

  getCompanyId () {
    return Sync.getCompanyId()
  }

  enqueueJob (event, params, options, callbacks) {
    return Worker.enqueueJob(event, params, options, callbacks)
  }

  dequeueJob (event) {
    return Worker.dequeueJob(event)
  }

  enqueueTask (event, params) {
    return Sync.enqueueTask(event, params)
  }

  heartbeat (interval, heartbeat) {
    try {
      const healthChecks = [ Sync.healthCheck(), Worker.healthCheck() ]

      const realInterval = Heartbeat.start(interval, heartbeat, () => Promise.all(healthChecks))

      return Promise.resolve(realInterval)
    } catch (error) {
      return Promise.reject(error)
    }
  }
}

module.exports = new Bot()
