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
  this._companyRef.child('/apps').on('child_changed', (snapshot) => {
    const app = {}
    app[ snapshot.key() ] = snapshot.val()

    configure.bind(this)(app)
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

        this._companyRef.child('/apps').once('value')
          .then((snapshot) => {
            const apps = snapshot.val()

            configure.bind(this)(apps)
          })
          .then(resolve)
          .catch(reject)
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
            this._companyRef.child('/apps').off('child_changed')
          }

          resolve()
        })
        .catch(reject)
    })
  }
}

module.exports = Apps
