/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const { Logger } = require('../utils')

const Sync = require('./sync')
const Worker = require('./worker')
const Heartbeat = require('./heartbeat')

class Bot {
  constructor () {
    this._sync = new Sync()
    this._worker = new Worker()
    this._heartbeat = new Heartbeat()
  }

  start (secret) {
    if (!secret) {
      throw new Error('invalid secret')
    }

    return this._worker.start()
      .then(() => {
        // unchain so we don't get blocked by not having an internet connection
        this._sync.start(secret)
          .then((id) => Logger.info(`Authenticated as ${id}`))
      })
      .catch(Logger.error)
  }

  stop () {
    return this._sync.stop()
      .then(() => this._worker.stop())
      .then(() => this._heartbeat.stop())
      .catch(Logger.error)
  }

  heartbeat (interval, heartbeat) {
    try {
      const healthChecks = [ this._sync.healthCheck(), this._worker.healthCheck() ]

      const realInterval = this._heartbeat.start(interval, heartbeat, () => Promise.all(healthChecks))

      return Promise.resolve(realInterval)
    } catch (error) {
      return Promise.reject(error)
    }
  }
}

module.exports = Bot
