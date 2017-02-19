/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const EventEmitter = require('events').EventEmitter

const Promise = require('bluebird')

const { Logger } = require('../utils')

const Sync = require('./sync')
const Worker = require('./worker')
const Heartbeat = require('./heartbeat')

class Bot extends EventEmitter {
  constructor () {
    super()

    Bot.prototype.emitAsync = Promise.promisify(EventEmitter.prototype.emit)

    this.setMaxListeners(256)
  }

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
    const healthChecks = [ Sync.healthCheck(), Worker.healthCheck() ]

    return Heartbeat.start(interval, heartbeat, () => Promise.all(healthChecks))
  }
}

module.exports = new Bot()
