/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const WORKER_DATABASE_TYPE = 'nosql'
const WORKER_DATABASE_NAME = 'worker'
const JobTypeEnum = { FAST: 'FAST', NORMAL: 'NORMAL', SLOW: 'SLOW' }
const JobTypeTtlEnum = {
  FAST: 10000, // 10 sec,
  NORMAL: 60000, // 1 min
  SLOW: 240000 // 4 min
}

const Promise = require('bluebird')

const { Logger, Communication } = require('../utils')

const Databases = require('../databases')

const kue = require('kue-scheduler')

class Worker {
  constructor () {
    this._schedules = {}
  }

  start () {
    return new Promise((resolve, reject) => {
      if (!Databases) {
        return reject(new Error('Unable to initialize worker because no database available'))
      }

      return Databases.startDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
        .then((database) => {
          this.queue = kue.createQueue(database)

          const process = (job, callback) => {
            const id = job.id
            const event = job.data.event
            const params = job.data.params
            const callbacks = job.data.callbacks || {}
            const retry = (job._max_attempts - (isNaN(job._attempts) ? 1 : job._attempts + 1)) > 0

            Logger.debug('Job ' + id + ' started' + (params ? ' with params ' + JSON.stringify(params) : ''))

            const success = (result) => {
              callback(null, result)

              if (callbacks.resolve) {
                Communication.emitAsync(callbacks.resolve, result)
              }
            }

            const failure = (error) => {
              if (!retry) {
                Logger.error(error)
              }

              callback(error)

              if (callbacks.reject) {
                Communication.emitAsync(callbacks.reject, error)
              }
            }

            Communication.emitAsync(event, params)
              .then(success)
              .catch((error) => {
                failure(error, job)
              })
          }

          this.queue.process(JobTypeEnum.FAST, process)
          this.queue.process(JobTypeEnum.NORMAL, process)
          this.queue.process(JobTypeEnum.SLOW, 2, process)

          this.queue.on('job enqueue', (id) => {
            kue.Job.get(id, (error, job) => {
              if (error) {
                Logger.error(error)

                return
              }

              Logger.debug('Job ' + id + ' queued with ' + job.data.event +
                (job.data.params ? ' and params ' + JSON.stringify(job.data.params) : ''))
            })
          })
          this.queue.on('job complete', (id, result) => {
            Logger.debug('Job ' + id + ' completed' + (result ? ' with result ' + JSON.stringify(result) : ''))

            kue.Job.get(id, (error, job) => {
              if (!error) {
                job.remove()
              }
            })
          })
          this.queue.on('job failed', (id, error) => {
            Logger.debug('Job ' + id + ' failed because of ' + error)
          })
          this.queue.on('job failed attempt', (id, error, attempts) => {
            Logger.debug('Job ' + id + ' failed ' + attempts + ' times')
          })
          this.queue.on('error', () => {})
        })
        .then(() => resolve())
        .catch(reject)
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      if (this.queue) {
        try {
          this.queue.shutdown(100, (error) => {
            if (error) {
              // reject(error)
              resolve()
            } else {
              resolve()
            }
          })
        } catch (ignored) {}
      } else {
        resolve()
      }
    })
      .then(() => {
        return Databases.stopDatabase(WORKER_DATABASE_TYPE, WORKER_DATABASE_NAME)
      })
  }

  enqueueJob (event, params, options, callbacks) {
    const _options = options || {}

    let type
    switch (event) {
      case 'social:linkedin:company:import':
      case 'person:device:discover':
        type = JobTypeEnum.SLOW
        break
      case 'bot:heartbeat':
        type = JobTypeEnum.FAST
        break
      default:
        type = JobTypeEnum.NORMAL
    }

    const job = this.queue.create(type, { event: event, params: params, callbacks: callbacks })
    job.ttl(JobTypeTtlEnum[ type ])

    if (_options.retry) {
      job.attempts(_options.retry)
    }

    if (_options.schedule) {
      this.queue.every(_options.schedule, job)
    } else {
      try {
        job.save((error) => {
          if (error) {
            throw error
          }
        })
      } catch (ignored) {}
    }
  }

  dequeueJob (event) {
    if (this.queue && this._schedules[ event ]) {
      this.queue.remove(this._schedules[ event ], (error) => {
        if (error) {
          // throw error
        } else {
          delete this._schedules[ event ]
        }
      })
    }
  }

  healthCheck () {
    return Promise.resolve()
  }
}

module.exports = new Worker()
