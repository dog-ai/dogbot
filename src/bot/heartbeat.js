/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const { Communication } = require('../utils')

function run (params, callback) {
  this._healthCheck()
    .then(() => this._heartbeat())
    .then(() => callback())
    .catch(callback)
}

class Heartbeat {
  start (interval, heartbeat, healthCheck) {
    if (this._isRunning) {
      throw new Error('already started')
    }

    if (!interval > 0) {
      throw new Error('invalid interval')
    }

    this._interval = interval / 2

    this._heartbeat = Promise.promisify(heartbeat)
    this._healthCheck = healthCheck

    Communication.on('bot:heartbeat', run.bind(this))
    Communication.emit('worker:job:enqueue', 'bot:heartbeat', null, { schedule: this._interval + ' seconds' })

    this._isRunning = true

    return this._interval
  }

  stop () {
    if (!this._isRunning) {
      return
    }

    Communication.emit('worker:job:dequeue', 'bot:heartbeat')
    Communication.removeListener('bot:heartbeat', run.bind(this))

    delete this._interval
    delete this._heartbeat
    delete this._isRunning
  }
}

module.exports = Heartbeat
