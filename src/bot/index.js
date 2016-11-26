/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const { Communication, Logger } = require('../utils')

const { AppManager, AppNotAvailableError, AppAlreadyDisabledError } = require('./apps')
const Sync = require('./sync')
const Worker = require('./worker')
const Heartbeat = require('./heartbeat')

function configureApps (apps) {
  return Promise.mapSeries(_.keys(apps), id => {
    const config = apps[ id ]
    const isEnabled = config.is_enabled

    if (isEnabled) {
      return this._appManager.enableApp(id, config)
        .catch(AppNotAvailableError, () => {})
        .catch(Logger.error)
    } else {
      return this._appManager.disableApp(id)
        .catch(AppAlreadyDisabledError, () => {})
        .catch(Logger.error)
    }
  })
    .catch(Logger.error)
}

class Bot {
  constructor (secret) {
    this.secret = secret

    this._appManager = new AppManager()
    this._worker = new Worker()
    this._heartbeat = new Heartbeat()
  }

  start () {
    if (!this.secret) {
      throw new Error('Please provide a secret.')
    }

    Logger.info('Starting dogbot')

    return this._worker.start()
      .then(() => {
        // unchain so we don't get blocked by not having an internet connection
        this._configureDataSync()
          .then(configureApps.bind(this))
          .then(this._configureTaskSync.bind(this))
      })
      .catch(Logger.error)
  }

  stop () {
    return this._appManager.disableAllApps()
      .then(() => Sync.terminate())
      .then(this._worker.stop)
      .then(this._heartbeat.stop)
      .then(() => Logger.info('Stopped dogbot'))
      .catch(Logger.error)
  }

  heartbeat (interval, heartbeat) {
    try {
      const healthChecks = [ this._appManager.healthCheck(), Sync.healthCheck(), this._worker.healthCheck() ]

      const realInterval = this._heartbeat.start(interval, heartbeat, () => Promise.all(healthChecks))

      return Promise.resolve(realInterval)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  _configureDataSync () {
    return Sync.initialize(this.secret,
      callback => {
        // start an outgoing periodic sync job every 10 minutes
        Communication.on('sync:outgoing:periodic', callback)
        Communication.emit('worker:job:enqueue', 'sync:outgoing:periodic', null, { schedule: '10 minutes' })
      },
      configureApps.bind(this)(),
      callback => {
        // listen for incoming sync callback registrations
        Communication.on('sync:incoming:register:setup', callback)
      },
      callback => {
        // listen for outgoing periodic sync callback registrations
        Communication.on('sync:outgoing:periodic:register', callback)
      },
      callback => {
        // listen for outgoing quickshot sync callback registrations
        Communication.on('sync:outgoing:quickshot:register', registerParams => {
          if (registerParams && registerParams.registerEvents) {
            _.forEach(registerParams.registerEvents, registerEvent => {
              // listen for outgoing quickshot events
              Communication.on(registerEvent, (outgoingParams, outgoingCallback) => {
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
        Communication.emit(event, params, callback)
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
    )
  }
}

module.exports = Bot
