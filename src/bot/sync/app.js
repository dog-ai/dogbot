/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const { Logger } = require('../../utils')

const { AppManager, AppNotAvailableError, AppAlreadyDisabledError } = require('../../apps')

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

class App {
  constructor () {
    this._appManager = new AppManager()
  }

  start (firebase, dogId, companyId) {
    return new Promise((resolve, reject) => {
      this._firebase = firebase

      if (companyId) {
        this._companyId = companyId
        this._companyRef = this._firebase.child(`companies/${this._companyId}`)

        this._companyRef.child('/apps').on('child_changed', (snapshot) => {
          var app = {}
          app[ snapshot.key() ] = snapshot.val()

          configureApps.bind(this)(app)
        })

        this._companyRef.child('/apps').once('value', (snapshot) => {
          const apps = snapshot.val()

          configureApps.bind(this)(apps)
        })
      }

      resolve()
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      this._appManager.disableAllApps()
        .then(resolve)
        .catch(reject)
    })
  }
}

module.exports = App
