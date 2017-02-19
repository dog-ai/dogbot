/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const Bot = require('./bot')

const { Communication } = require('../utils')

function run (params, callback) {
  this._healthCheck()
    .then(() => this._heartbeat())
    .then(() => callback())
    .catch(callback)
}

class Heartbeat {
  start (interval, heartbeat, healthCheck) {
    return new Promise((resolve, reject) => {
      if (this._isRunning) {
        return reject(new Error('already started'))
      }

      if (!interval > 0) {
        return reject(new Error('invalid interval'))
      }

      this._interval = interval / 2

      this._heartbeat = Promise.promisify(heartbeat)
      this._healthCheck = healthCheck

      Communication.on('bot:heartbeat', run.bind(this))

      const options = { schedule: this._interval + ' seconds' }
      Bot.enqueueJob('bot:heartbeat', null, options)

      this._isRunning = true

      resolve(this._interval)
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      if (!this._isRunning) {
        return resolve()
      }

      Bot.dequeueJob('bot:heartbeat')

      Communication.removeListener('bot:heartbeat', run.bind(this))

      delete this._interval
      delete this._heartbeat
      delete this._isRunning

      resolve()
    })
  }
}

module.exports = new Heartbeat()
