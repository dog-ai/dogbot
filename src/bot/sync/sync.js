/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'local'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const URL = `https://${PROJECT_ID}.firebaseio.com`

const Promise = require('bluebird')

const { Logger } = require('../../utils')

const moment = require('moment-timezone')

const Firebase = require('firebase')

const Tasks = require('./tasks')
const Modules = require('./modules')
const Apps = require('./apps')

function goOnline (id) {
  return new Promise((resolve, reject) => {
    this._dogId = id
    this._dogRef = this._firebase.child(`dogs/${this._dogId}`)

    this._dogRef.once('value')
      .then((snapshot) => {
        const dog = snapshot.val()

        if (dog.timezone) {
          moment.tz.setDefault(dog.timezone)
        }

        if (ENVIRONMENT !== 'local') {
          // https://www.firebase.com/docs/web/guide/offline-capabilities.html#section-connection-state
          const connectionState = (snapshot) => {
            const connected = snapshot.val()

            if (connected) {
              this._dogRef.onDisconnect().update({
                updated_date: Firebase.ServerValue.TIMESTAMP,
                is_online: false,
                last_seen_date: Firebase.ServerValue.TIMESTAMP
              })

              this._dogRef.update({
                updated_date: Firebase.ServerValue.TIMESTAMP,
                is_online: true,
                last_authentication_date: Firebase.ServerValue.TIMESTAMP,
                last_seen_date: Firebase.ServerValue.TIMESTAMP
              })
            }
          }

          this._firebase.child('.info/connected').on('value', connectionState)
        }

        resolve(dog)
      })
      .catch(reject)
  })
}

function authenticate (token) {
  return new Promise((resolve, reject) => {
    Firebase.goOnline()

    this._firebase.authWithCustomToken(token)
      .then((authData) => {
        const id = authData.uid

        Logger.info(`Authenticated as ${id}`)

        goOnline.bind(this)(id)
          .then(resolve)
          .then(reject)
      })
      .catch(reject)
  })
}

function unauthenthicate () {
  return new Promise((resolve) => {
    Firebase.goOffline()

    delete this._dogId
    delete this._dogRef

    resolve()
  })
}

class Sync {
  constructor () {
    this._firebase = new Firebase(URL)

    this._modules = new Modules()
    this._apps = new Apps()
  }

  start (token) {
    return new Promise((resolve, reject) => {
      return authenticate.bind(this)(token)
        .then((account) => {
          if (account.company_id) {
            this._companyId = account.company_id
          }

          resolve(this._dogId)
        })
        .then(() => this._modules.start(this._firebase, this._dogId, this._companyId))
        .then(() => Tasks.start(this._firebase, this._dogId, this._companyId))
        .then(() => this._apps.start(this._firebase, this._dogId, this._companyId))
        .catch(reject)
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      this._apps.stop()
        .then(() => Tasks.stop())
        .then(() => this._modules.stop())
        .then(unauthenthicate.bind(this))
        .then(() => {
          delete this._companyId
          delete this._dogId
        })
        .then(resolve)
        .catch(reject)
    })
  }

  getCompanyId () {
    return this._companyId
  }

  enqueueTask (event, params) {
    return Tasks.enqueueTask(event, params)
  }

  healthCheck () {
    return Promise.resolve()
  }
}

module.exports = new Sync()
