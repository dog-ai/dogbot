/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const Communication = require('../utils/communication.js')

const heartbeat = (params, callback) => {
  this.healthcheck()
    .then(() => this.heartbeat())
    .then(callback)
    .catch(error => callback(error))
}

class Heartbeat {
  initialize (interval, heartbeatFn, healthCheckFn) {
    return new Promise((resolve, reject) => {
      if (!interval > 0) {
        return reject(new Error('invalid interval'))
      }

      this.interval = interval / 2

      this.heartbeat = Promise.promisify(heartbeatFn)
      this.healthcheck = healthCheckFn

      Communication.on('bot:heartbeat', heartbeat.bind(this))
      Communication.emit('worker:job:enqueue', 'bot:heartbeat', null, { schedule: this.interval + ' seconds' })

      this.isInitialized = true

      resolve(this.interval)
    })
  }

  terminate () {
    return new Promise((resolve) => {
      if (!this.isInitialized) {
        return resolve()
      }

      Communication.emit('worker:job:dequeue', 'bot:heartbeat')
      Communication.removeEventListener('bot:heartbeat', heartbeat.bind(this))

      delete this.interval
      delete this.heartbeat
      delete this.isInitialized

      resolve()
    })
  }
}

module.exports = new Heartbeat()
