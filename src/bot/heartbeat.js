/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const Communication = require('../utils/communication.js')

class Heartbeat {
  initialize (interval, heartbeatFn, healthCheckFn) {
    return new Promise((resolve, reject) => {
      if (!interval > 0) {
        return reject(new Error('invalid interval'))
      }

      this._heartbeatFn = Promise.promisify(heartbeatFn)
      this._healthCheckFn = healthCheckFn

      this._interval = interval / 2

      Communication.on('bot:heartbeat', this._sendHeartbeat)
      Communication.emit('worker:job:enqueue', 'bot:heartbeat', null, { schedule: this._interval + ' seconds' })

      this._initialized = true

      resolve(this._interval)
    })
  }

  terminate () {
    return new Promise((resolve) => {
      if (!this._initialized) {
        return resolve()
      }

      Communication.emit('worker:job:dequeue', 'bot:heartbeat')
      Communication.removeEventListener('bot:heartbeat', this._sendHeartbeat)

      delete this._interval
      delete this._heartbeatFn
      delete this._initialized

      resolve()
    })
  }

  _sendHeartbeat (params, callback) {
    this._healthCheckFn()
      .then(() => this._heartbeatFn())
      .then(callback)
      .catch(error => callback(error))
  }
}

module.exports = new Heartbeat()
