/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('../../utils/logger.js')
const moment = require('moment-timezone')

const Firebase = require('firebase')
const firebase = new Firebase(`https://${FIREBASE_PROJECT_ID}.firebaseio.com`)

const Task = require('./task.js')

class Sync {
  initialize (token,
              startOutgoingPeriodicSynchronizationFn,
              onCompanyAppChangedCallback,
              registerIncomingSynchronizationFn,
              registerOutgoingPeriodicSynchronizationFn,
              registerOutgoingQuickshotSynchronizationFn,
              onOutgoingSynchronizeCallback) {
    return new Promise((resolve, reject) => {
      return this._authenticate(token)
        .then((dog) => {
          this.outgoingSynchronizeEvents = []

          startOutgoingPeriodicSynchronizationFn(this._periodicOutgoingSynchronization.bind(this))
          this.onCompanyAppChangedCallback = onCompanyAppChangedCallback
          registerIncomingSynchronizationFn(this._registerIncomingSynchronization.bind(this))
          registerOutgoingPeriodicSynchronizationFn(this._registerPeriodicOutgoingSynchronization.bind(this))
          registerOutgoingQuickshotSynchronizationFn(this._quickshotOutgoingSynchronization.bind(this))
          this.onOutgoingSynchronizeCallback = onOutgoingSynchronizeCallback

          if (dog.company_id) {
            this.companyId = dog.company_id
            this.companyRef = firebase.child('companies/' + dog.company_id)

            this.companyRef.child('/apps').on('child_changed', (snapshot) => {
              var app = {}
              app[ snapshot.key() ] = snapshot.val()

              this.onCompanyAppChangedCallback(app)
            })

            this.companyRef.child('/apps').once('value',
              (snapshot) => {
                resolve([
                  this.dogId,
                  snapshot.val()
                ])
              },
              (error) => {
                reject(error)
              })
          } else {
            resolve([ this.dogId ])
          }
        })
    })
  }

  initializeTask (onIncomingTaskCallback) {
    Task.initialize(firebase, this.companyId, onIncomingTaskCallback)
  }

  terminate () {
    return new Promise((resolve, reject) => {

      return Task.terminate()
        .then(this._unauthenthicate)
        .then(() => {
          delete this.companyId
          delete this.companyRef
        })
        .then(resolve)
        .catch(reject)
    })
  }

  _authenticate (token) {
    return new Promise((resolve, reject) => {

      Firebase.goOnline()
      firebase.authWithCustomToken(token, (error, authData) => {
        if (error) {
          reject(error)
        } else {
          this.dogId = authData.uid
          this.dogRef = firebase.child('dogs/' + this.dogId)
          this.dogRef.once('value', (snapshot) => {
            var dog = snapshot.val()
            if (dog.timezone) {
              moment.tz.setDefault(dog.timezone)
            }

            if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {

              // https://www.firebase.com/docs/web/guide/offline-capabilities.html#section-connection-state
              firebase.child('.info/connected').on('value', (snapshot) => {
                var connected = snapshot.val()

                if (connected) {
                  this.dogRef.onDisconnect().update({
                    updated_date: Firebase.ServerValue.TIMESTAMP,
                    is_online: false,
                    last_seen_date: Firebase.ServerValue.TIMESTAMP
                  })

                  this.dogRef.update({
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
        }
      })

    })
  }

  _unauthenthicate () {
    return new Promise((resolve) => {
      Firebase.goOffline()

      delete this.dogId
      delete this.dogRef

      resolve()
    })
  }

  _periodicOutgoingSynchronization (params, callback) {

    if (this.companyRef) {
      _.forEach(this.outgoingSynchronizeEvents, (outgoing) => {
        this.onOutgoingSynchronizeCallback(outgoing.event, null, (error, companyResourceObj, callback) => {
          if (error) {
            Logger.error(error.stack)
          } else {
            this._sendCompanyResource(outgoing.companyResource, companyResourceObj, (error) => {
              callback(error, companyResourceObj)
            })
          }
        })
      })
    }

    var now = moment().format()

    if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
      this.dogRef.update({ last_seen_date: now, updated_date: now })
    }

    callback()
  }

  _quickshotOutgoingSynchronization (registerParams, outgoingParams, callback) {

    const quickshot = (error, companyResourceObj, callback) => {
      if (error) {
        if (callback) {
          callback(error)
        }
      } else {
        this._sendCompanyResource(registerParams.companyResource, companyResourceObj, (error) => {
          if (callback) {
            callback(error, companyResourceObj)
          }
        })
      }
    }

    if (registerParams.outgoingEvent) {
      // quickshot event callback
      this.onOutgoingSynchronizeCallback(registerParams.outgoingEvent, outgoingParams, quickshot)
    } else {
      // quickshot function callback
      registerParams.outgoingFunction(outgoingParams, quickshot)
    }

    var now = moment().format()

    if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
      this.dogRef.update({ last_seen_date: now, updated_date: now })
    }

    if (callback) {
      callback()
    }
  }

  _registerIncomingSynchronization (params, callback) {
    if (this.companyRef) {
      if (params.companyResource == 'employee_performances') {

        var date = moment()
        var dateFormatPattern
        switch (params.period) {
          case 'day':
            date.subtract(1, 'day')
            dateFormatPattern = 'YYYY/MM/DD'
            break
          case 'month':
            // if start of month retrieve previous month stats
            if (date.date() === 1) {
              date.subtract(1, 'days')
            }

            dateFormatPattern = 'YYYY/MM'
            break
          case 'year':
            // if start of year retrieve previous month stats
            if (date.dayOfYear() === 1) {
              date.subtract(1, 'days')
            }

            dateFormatPattern = 'YYYY'
            break
          case 'all-time':
          default:
            date = null
        }

        firebase.child('company_employee_performances/' +
          this.companyId + '/' +
          params.employeeId + '/' +
          params.name + '/' +
          (dateFormatPattern != null ? date.format(dateFormatPattern) + '/' : '') +
          '/_stats')
          .once('value', (snapshot) => {
            var stats = snapshot.val()
            if (stats) {

              Logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(stats))

              params.onCompanyResourceChangedCallback(stats, date)
            }
          })

      } else {
        this.companyRef.child('/' + params.companyResource).on('child_added',
          snapshot => {
            var resourceId = snapshot.key()

            const convert = (resource) => {
              if (resource !== null) {
                if (resource.created_date !== undefined && resource.created_date !== null) {
                  resource.created_date = new Date(resource.created_date)
                }

                if (resource.updated_date !== undefined && resource.updated_date !== null) {
                  resource.updated_date = new Date(resource.updated_date)
                }

                if (resource.last_presence_date !== undefined && resource.last_presence_date !== null) {
                  resource.last_presence_date = new Date(resource.last_presence_date)
                }

                if (resource.last_scan_date !== undefined && resource.last_scan_date !== null) {
                  resource.last_scan_date = new Date(resource.last_scan_date)
                }
              }
            }

            var addedCallback = _.once((resource) => {
              params.onCompanyResourceAddedCallback(_.extend({
                id: resourceId,
                is_synced: true
              }, resource))
            })

            var changedCallback = _.after(2, (resource) => {
              params.onCompanyResourceChangedCallback(_.extend({
                id: resourceId,
                is_synced: true
              }, resource))
            })

            firebase.child('company_' + params.companyResource + '/' + this.companyId + '/' + resourceId).on('value', (snapshot) => {
              var resource = snapshot.val()

              Logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(resource))

              convert(resource)

              addedCallback(resource)
              changedCallback(resource)

            })

          })

        this.companyRef.child('/' + params.companyResource).on('child_removed',
          (snapshot) => {
            var resourceId = snapshot.key()

            Logger.debug('Incoming deleted ' + params.companyResource + ': %s', resourceId)

            firebase.child('company_' + params.companyResource + '/' + this.companyId + '/' + resourceId).off('value')
            params.onCompanyResourceRemovedCallback({ id: resourceId })
          })
      }
    }

    callback()
  }

  _registerPeriodicOutgoingSynchronization (params, callback) {
    this.outgoingSynchronizeEvents.push({
      event: params.event,
      companyResource: params.companyResource
    })

    callback()
  }

  _sendCompanyResource (companyResource, companyResourceObj, callback) {
    if (!this.companyRef) {
      callback()
    }

    if (companyResourceObj.is_to_be_deleted) {

      this.companyRef.child(companyResource + '/' + companyResourceObj.id).remove((error) => {
        if (error) {
          Logger.error(error.stack)
        } else {
          var companyResourceRef = firebase.child('company_' + companyResource + '/' + this.companyId + '/' + companyResourceObj.id)

          if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
            companyResourceRef.set(null, (error) => {
              callback(error, companyResourceObj)
            })
          } else {
            callback(null, companyResourceObj)
          }
        }
      })

    } else {
      var val = _.omit(companyResourceObj, [ 'id', 'is_synced' ])
      val.created_date = moment(val.created_date).format()
      val.updated_date = moment(val.updated_date).format()
      if (val.last_presence_date !== undefined && val.last_presence_date !== null) {
        val.last_presence_date = moment(val.last_presence_date).format()
      }
      if (val.last_scan_date !== undefined && val.last_scan_date !== null) {
        val.last_scan_date = moment(val.last_scan_date).format()
      }

      if (companyResourceObj.is_manual) {
        val = _.omit(val, [ 'name', 'type', 'os' ])
      }

      var companyResourceRef
      if (companyResource == 'employee_performances') {
        val = _.omit(val, [ 'name', 'employee_id' ])

        var date

        var dateFormatPattern = 'YYYY/MM/DD'
        var isStats = false

        if (companyResourceObj.period) {
          switch (companyResourceObj.period) {
            case 'month':
              date = moment(companyResourceObj.period_start_date)

              Logger.debug('Outgoing employee performance month stats: %s', JSON.stringify(companyResourceObj))

              dateFormatPattern = 'YYYY/MM'
              break
            case 'year':
              date = moment(companyResourceObj.period_start_date)

              Logger.debug('Outgoing employee performance year stats: %s', JSON.stringify(companyResourceObj))

              dateFormatPattern = 'YYYY'
              break
            case 'all-time':
              Logger.debug('Outgoing employee performance all-time stats: %s', JSON.stringify(companyResourceObj))

              dateFormatPattern = null
              break
            default:
              date = moment(companyResourceObj.period_start_date)

              Logger.debug('Outgoing employee performance day stats: %s', JSON.stringify(companyResourceObj))
          }

          isStats = true
        } else {
          date = moment(companyResourceObj.created_date)

          val = _.omit(val, [ 'updated_date' ])

          Logger.debug('Outgoing employee performances: %s', JSON.stringify(companyResourceObj))
        }

        companyResourceRef = firebase.child('company_' + companyResource + '/' +
          this.companyId + '/' +
          companyResourceObj.employee_id + '/' +
          companyResourceObj.name + '/' +
          (dateFormatPattern != null ? date.format(dateFormatPattern) + '/' : '') +
          (isStats ? '_stats' : ''))

        if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
          if (isStats) {
            companyResourceRef.set(val, callback)
          } else {
            companyResourceRef.push(val, callback)
          }
        } else {
          callback(null)
        }

      } else {

        Logger.debug('sending ' + companyResource + ': %s', JSON.stringify(companyResourceObj))

        val = _.omit(val, [ 'is_to_be_deleted' ])

        if (companyResource === 'mac_addresses') {
          val = _.omit(val, [ 'is_present' ])
        }

        val = _.extend(val, { company_id: this.companyId })

        if (companyResource === 'notifications') {
          val = _.omit(val, [ 'company_id', 'updated_date' ])
        }

        companyResourceRef = firebase.child('company_' + companyResource + '/' +
          this.companyId + '/' +
          companyResourceObj.id)

        const getPriority = (companyResource, companyResourceObj) => {
          var priority

          switch (companyResource) {
            case 'employees':
            case 'devices':
              if (companyResourceObj.last_presence_date) {
                priority = -moment(companyResourceObj.last_presence_date).valueOf()

                // if the employee/device is not present lets make sure he drops 12 minutes
                if (companyResourceObj.is_present !== undefined && !companyResourceObj.is_present) {
                  priority += 720000
                }
              } else {
                priority = null
              }
              break
            default:
              priority = null
          }

          return priority
        }

        if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {

          companyResourceRef.update(val, (error) => {
            if (error) {
              callback(error)
            } else {
              var priority = getPriority(companyResource, companyResourceObj)

              if (priority) {
                this.companyRef.child(companyResource + '/' + companyResourceRef.key()).setWithPriority(true, priority, (error) => {
                  callback(error)
                })
              } else {
                this.companyRef.child(companyResource + '/' + companyResourceRef.key()).set(true, (error) => {
                  callback(error)
                })
              }
            }
          })
        } else {
          callback(null)
        }
      }
    }

  }

  healthCheck () {
    return Promise.resolve()
  }
}

module.exports = new Sync()
