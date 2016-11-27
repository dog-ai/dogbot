/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'local'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const URL = `https://${PROJECT_ID}.firebaseio.com`

const Promise = require('bluebird')

const moment = require('moment-timezone')

const Firebase = require('firebase')

const Tasks = require('./tasks')
const Modules = require('./modules')
const Apps = require('./apps')

function goOnline (id) {
  return new Promise((resolve, reject) => {
    this._dogId = id
    this._dogRef = this._firebase.child(`dogs/${this._dogId}`)

    this._dogRef.once('value', (snapshot) => {
      const dog = snapshot.val()

      if (dog.timezone) {
        moment.tz.setDefault(dog.timezone)
      }

      if (ENVIRONMENT !== 'local') {
        // https://www.firebase.com/docs/web/guide/offline-capabilities.html#section-connection-state
        this._firebase.child('.info/connected').on('value', (snapshot) => {
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
        })
      }

      resolve(dog)
    }, (error) => {
      reject(error)
    })
  })
}

function authenticate (token) {
  return new Promise((resolve, reject) => {
    Firebase.goOnline()

    this._firebase.authWithCustomToken(token, (error, authData) => {
      if (error) {
        return reject(error)
      } else {
        goOnline.bind(this)(authData.uid)
          .then(resolve)
          .then(reject)
      }
    })
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

    this._tasks = new Tasks()
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
        .then(() => this._tasks.start(this._firebase, this._dogId, this._companyId))
        .then(() => this._apps.start(this._firebase, this._dogId, this._companyId))
        .catch(reject)
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      this._app.stop()
        .then(() => this._task.stop())
        .then(() => this._module.stop())
        .then(unauthenthicate.bind(this))
        .then(() => {
          delete this._companyId
          delete this._dogId
        })
        .then(resolve)
        .catch(reject)
    })
  }

  healthCheck () {
    return Promise.resolve()
  }
}

module.exports = Sync
