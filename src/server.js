/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const Logger = require('modern-logger')

const { Sync, Worker, Heartbeat, Communication } = require('./core')

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

  on (event, callback) {
    Communication.on(event, callback)
  }

  once (event, callback) {
    Communication.once(event, callback)
  }

  removeListener (event, callback) {
    Communication.removeListener(event, callback)
  }

  removeAllListeners (event) {
    Communication.removeAllListeners(event)
  }

  emit (event, ...params) {
    Communication.emit(event, ...params)
  }

  emitAsync (event, ...params) {
    return Communication.emitAsync(event, ...params)
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
    const healthChecks = [ Sync.healthCheck(), Worker.healthCheck() ]

    return Heartbeat.start(interval, heartbeat, () => Promise.all(healthChecks))
  }
}

module.exports = new Bot()
