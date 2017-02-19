/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const { Communication, Logger } = require('../../utils')

const FirebaseQueue = require('firebase-queue')

function enqueueJob (event, params, progress, resolve, reject) {
  const now = _.now()
  const callbacks = {
    'progress': event + ':progress:' + now,
    'resolve': event + ':resolve:' + now,
    'reject': event + ':reject:' + now
  }

  const onResolve = (result) => {
    resolve(result)

    Communication.removeListener(callbacks.progress, progress)
    Communication.removeListener(callbacks.reject, onReject)
  }

  const onReject = (error) => {
    reject(error)

    Communication.removeListener(callbacks.progress, progress)
    Communication.removeListener(callbacks.resolve, onResolve)
  }

  Communication.on(callbacks.progress, progress)
  Communication.once(callbacks.resolve, onResolve)
  Communication.once(callbacks.reject, onReject)

  Communication.emit('worker:job:enqueue', event, params, null, callbacks)
}

function onCreate (task, progress, resolve, reject) {
  Logger.debug('Incoming task: ' + JSON.stringify(task))

  if (!task || !task.event) {
    return reject('Invalid task')
  }

  enqueueJob(task.event, task.data, progress, resolve, reject)
}

class Tasks {
  start (firebase, dogId, companyId) {
    this._firebase = firebase

    if (companyId) {
      this._companyId = companyId
      this._companyRef = this._firebase.child(`companies/${this._companyId}`)

      const refs = {
        tasksRef: firebase.child(`companies/${this._companyId}/tasks`),
        specsRef: firebase.child('queue/specs')
      }

      const options = { specId: 'default_spec', numWorkers: 1, suppressStack: true }

      this._queue = new FirebaseQueue(refs, options, onCreate.bind(this))
    }
  }

  stop () {
    return new Promise((resolve, reject) => {
      this._queue.shutdown()
        .then(resolve)
        .catch(reject)
    })
  }

  enqueueTask (event, params) {
    return new Promise((resolve, reject) => {
      const task = { event, data: params, _state: 'spark' }

      this._companyRef.child('tasks')
        .push(task, (error) => {
          if (error) {
            return reject(error)
          }

          resolve()
        })
    })
  }
}

module.exports = new Tasks()
