/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('../utils/logger.js')
const communication = require('../utils/communication.js')

const modules = require('../modules')(communication)
const Databases = require('../databases')

const apps = require('./apps')(communication, modules, Databases)
const Sync = require('./sync')
const Worker = require('./worker.js')
const Heartbeat = require('./heartbeat.js')

class Bot {
  constructor (secret) {
    if (!secret) {
      throw new Error('Please provide a secret.')
    }

    this.secret = secret
  }

  start () {
    Logger.info('Starting dogbot')

    return this._configureWorker()
      .then(() => {
        // unchain so we don't get blocked by not having an internet connection
        this._configureDataSync()
          .then(this._configureApps)
          .then(this._configureTaskSync)
      })
      .catch(this.report)
  }

  stop () {
    return apps.disableAllApps()
      .then(Sync.terminate)
      .then(Worker.terminate)
      .then(Heartbeat.terminate)
      .then(() => Logger.info('Stopped dogbot'))
      .catch(this.report)
  }

  static report (error, callback) {
    if (!error) {
      return
    }

    // https://github.com/winstonjs/winston/pull/838
    const _callback = callback === undefined ? null : callback

    Logger.error(error.message, error, _callback)
  }

  heartbeat (interval, heartbeat) {
    const healthChecks = [ apps.healthCheck(), Sync.healthCheck(), Worker.healthCheck() ]

    return Heartbeat.initialize(interval, heartbeat, () => Promise.all(healthChecks))
      .then(interval => Logger.info('Sending a heartbeat every ' + interval + ' seconds'))
  }

  static autoupdate (branch, updateFn) {
    autoupdate.initialize(branch, updateFn)
  }

  _configureWorker () {
    return Worker.initialize(
      callback => communication.on('Worker:job:enqueue', callback),
      callback => communication.on('Worker:job:dequeue', callback),
      (event, params) => communication.emitAsync(event, params)
    )
  }

  _configureDataSync () {
    return Sync.initialize(this.secret,
      callback => {
        // start an outgoing periodic sync job every 10 minutes
        communication.on('sync:outgoing:periodic', callback)
        communication.emit('Worker:job:enqueue', 'sync:outgoing:periodic', null, { schedule: '10 minutes' })
      },
      this._configureApps,
      callback => {
        // listen for incoming sync callback registrations
        communication.on('sync:incoming:register:setup', callback)
      },
      callback => {
        // listen for outgoing periodic sync callback registrations
        communication.on('sync:outgoing:periodic:register', callback)
      },
      callback => {
        // listen for outgoing quickshot sync callback registrations
        communication.on('sync:outgoing:quickshot:register', registerParams => {
          if (registerParams && registerParams.registerEvents) {
            _.forEach(registerParams.registerEvents, registerEvent => {
              // listen for outgoing quickshot events
              communication.on(registerEvent, (outgoingParams, outgoingCallback) => {
                // split quickshot event arguments
                // let outgoingCallback = arguments.length > 1 && _.isFunction(arguments[arguments.length - 1]) ? arguments[arguments.length - 1] : undefined
                // let outgoingParams = [].slice.call(arguments, 0, outgoingCallback ? arguments.length - 1 : arguments.length)

                // sync module will take care of doing the quickshot
                callback(registerParams, outgoingParams, outgoingCallback)
              })
            })
          }
        })
      },
      (event, params, callback) => {
        // trigger incoming sync data events
        communication.emit(event, params, callback)
      }
    ).spread((dogId, apps) => {
      Logger.info('Authenticated as ' + dogId)

      return apps
    })
  }

  _configureTaskSync () {
    return Sync.initializeTask(
      (event, params, progress, resolve, reject) => {
        // trigger incoming sync task events

        const now = _.now()
        const callbacks = {
          'progress': event + ':progress:' + now,
          'resolve': event + ':resolve:' + now,
          'reject': event + ':reject:' + now
        }

        const onResolve = (result) => {
          resolve(result)

          communication.removeListener(callbacks.progress, progress)
          communication.removeListener(callbacks.reject, onReject)
        }

        const onReject = (error) => {
          reject(error)

          communication.removeListener(callbacks.progress, progress)
          communication.removeListener(callbacks.resolve, onResolve)
        }

        communication.on(callbacks.progress, progress)
        communication.once(callbacks.resolve, onResolve)
        communication.once(callbacks.reject, onReject)

        communication.emit('Worker:job:enqueue', event, params, null, callbacks)
      }
    )
  }

  _configureApps (_apps) {
    return Promise.all(
      _.map(_apps, (appConfig, appName) => appConfig.is_enabled ? apps.enableApp(appName, appConfig) : apps.disableApp(appName)))
  }
}

module.exports = Bot
