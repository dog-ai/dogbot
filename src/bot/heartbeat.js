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

      this._interval = interval / 2

      this._heartbeat = Promise.promisify(heartbeatFn)
      this._healthCheck = healthCheckFn

      Communication.on('bot:heartbeat', this._sendHeartbeat)
      Communication.emit('worker:job:enqueue', 'bot:heartbeat', null, { schedule: this._interval + ' seconds' })

      this._isInitialized = true

      resolve(this._interval)
    })
  }

  terminate () {
    return new Promise((resolve) => {
      if (!this._isInitialized) {
        return resolve()
      }

      Communication.emit('worker:job:dequeue', 'bot:heartbeat')
      Communication.removeEventListener('bot:heartbeat', this._sendHeartbeat)

      delete this._interval
      delete this._heartbeat
      delete this._isInitialized

      resolve()
    })
  }

  _sendHeartbeat (params, callback) {
    this._healthCheck()
      .then(() => this._heartbeat())
      .then(callback)
      .catch(error => callback(error))
  }
}

module.exports = new Heartbeat()
