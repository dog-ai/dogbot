/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const { Logger } = require('../../utils')

const { AppManager, AppNotAvailableError, AppAlreadyDisabledError } = require('../../apps')

function configure (apps) {
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

function onChanges () {
  this._firebase.child('/apps').on('child_changed', (snapshot) => {
    const appId = snapshot.key()
    const apps = {}
    apps[ appId ] = snapshot.val()

    this._companyRef.child(`/apps/${appId}`).once('value')
      .then((snapshot) => {
        const _apps = {}
        _apps[ appId ] = snapshot.val()

        const __apps = _.merge({}, apps, _apps)

        configure.bind(this)(__apps)
      })
      .catch(Logger.error)
  }, Logger.error)

  this._companyRef.child('/apps').on('child_changed', (snapshot) => {
    const appId = snapshot.key()
    const apps = {}
    apps[ appId ] = snapshot.val()

    this._firebase.child(`/apps/${appId}`).once('value')
      .then((snapshot) => {
        const _apps = {}
        _apps[ appId ] = snapshot.val()

        const __apps = _.merge({}, apps, _apps)

        configure.bind(this)(__apps)
      })
      .catch(Logger.error)
  }, Logger.error)
}

class Apps {
  constructor () {
    this._appManager = new AppManager()
  }

  start (firebase, dogId, companyId) {
    return new Promise((resolve, reject) => {
      this._firebase = firebase
      this._companyId = companyId

      if (this._companyId) {
        this._companyRef = this._firebase.child(`companies/${this._companyId}`)

        this._firebase.child('/apps').once('value')
          .then((snapshot) => {
            const apps = snapshot.val()

            return this._companyRef.child('/apps').once('value')
              .then((snapshot) => {
                const _apps = _.merge({}, apps, snapshot.val())

                configure.bind(this)(_apps)
              })
              .then(resolve)
              .catch(reject)
          })
      } else {
        resolve()
      }
    })
      .then(onChanges.bind(this))
  }

  stop () {
    return new Promise((resolve, reject) => {
      this._appManager.disableAllApps()
        .then(() => {
          if (this._companyId) {
            this._firebase.child('/apps').off('child_changed')
            this._companyRef.child('/apps').off('child_changed')
          }

          resolve()
        })
        .catch(reject)
    })
  }
}

module.exports = Apps
