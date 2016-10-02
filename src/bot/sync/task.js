/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')
const Logger = require('../../utils/logger.js')

const FirebaseQueue = require('firebase-queue')

class Task {
  initialize (ref, companyId, onIncomingTaskCallback) {
    const refs = {
      tasksRef: ref.child('companies/' + companyId + '/tasks'),
      specsRef: ref.child('queue/specs')
    }

    const options = { specId: 'default_spec', numWorkers: 1, suppressStack: true }

    this._queue = new FirebaseQueue(refs, options, (task, progress, resolve, reject) => {
      Logger.debug('Incoming task: ' + JSON.stringify(task))

      if (!task || !task.event) {
        return reject('Invalid task')
      }

      onIncomingTaskCallback(task.event, task.data, progress, resolve, reject)
    })
  }

  terminate () {
    return new Promise((resolve, reject) => {
      this._queue.shutdown()
        .then(resolve)
        .catch(reject)
    })
  }
}

module.exports = new Task()
