/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'local'

const _ = require('lodash')
const Promise = require('bluebird')

const Worker = require('../worker')
const Communication = require('../communication')

const moment = require('moment-timezone')

const { Logger } = require('../../utils')

class Modules {
  start (firebase, dogId, companyId) {
    return new Promise((resolve, reject) => {
      this._firebase = firebase
      this._dogId = dogId
      this._dogRef = this._firebase.child(`dogs/${this._dogId}`)

      if (companyId) {
        this._companyRef = this._firebase.child(`companies/${companyId}`)
        this._companyId = companyId

        this.outgoingSynchronizeEvents = []

        // start an outgoing periodic sync job every 10 minutes
        Communication.on('sync:outgoing:periodic', this._periodicOutgoingSynchronization.bind(this))
        const options = { schedule: '10 minutes' }
        Worker.enqueueJob('sync:outgoing:periodic', null, options)

        // listen for incoming sync callback registrations
        Communication.on('sync:incoming:register:setup', this._registerIncomingSynchronization.bind(this))

        // listen for outgoing periodic sync callback registrations
        Communication.on('sync:outgoing:periodic:register', this._registerPeriodicOutgoingSynchronization.bind(this))

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
                this._quickshotOutgoingSynchronization.bind(this)(registerParams, outgoingParams, outgoingCallback)
              })
            })
          }
        })
      }

      resolve()
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      resolve()
    })
  }

  _periodicOutgoingSynchronization (params, callback) {
    if (this._companyRef) {
      _.forEach(this.outgoingSynchronizeEvents, (outgoing) => {
        Communication.emit(outgoing.event, null, (error, companyResourceObj, callback) => {
          if (error) {
            Logger.error(error)
          } else {
            this._sendCompanyResource(outgoing.companyResource, companyResourceObj, (error) => {
              callback(error, companyResourceObj)
            })
          }
        })
      })
    }

    var now = moment().format()

    if (ENVIRONMENT !== 'local') {
      this._dogRef.update({ last_seen_date: now, updated_date: now })
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
      Communication.emit(registerParams.outgoingEvent, outgoingParams, quickshot)
    } else {
      // quickshot function callback
      registerParams.outgoingFunction(outgoingParams, quickshot)
    }

    var now = moment().format()

    if (ENVIRONMENT !== 'local') {
      this._dogRef.update({ last_seen_date: now, updated_date: now })
    }

    if (callback) {
      callback()
    }
  }

  _registerIncomingSynchronization (params, callback) {
    if (this._companyRef) {
      if (params.companyResource === 'employee_performances') {
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

        this._firebase.child('company_employee_performances/' +
          this._companyId + '/' +
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
        this._companyRef.child('/' + params.companyResource).on('child_added',
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

            this._firebase.child('company_' + params.companyResource + '/' + this._companyId + '/' + resourceId).on('value', (snapshot) => {
              var resource = snapshot.val()

              Logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(resource))

              convert(resource)

              addedCallback(resource)
              changedCallback(resource)
            })
          })

        this._companyRef.child('/' + params.companyResource).on('child_removed',
          (snapshot) => {
            var resourceId = snapshot.key()

            Logger.debug('Incoming deleted ' + params.companyResource + ': %s', resourceId)

            this._firebase.child('company_' + params.companyResource + '/' + this._companyId + '/' + resourceId).off('value')
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
    if (!this._companyRef) {
      callback()
    }

    if (companyResourceObj.is_to_be_deleted) {
      this._companyRef.child(companyResource + '/' + companyResourceObj.id).remove((error) => {
        if (error) {
          Logger.error(error)
        } else {
          var companyResourceRef = this._firebase.child('company_' + companyResource + '/' + this._companyId + '/' + companyResourceObj.id)

          if (ENVIRONMENT !== 'local') {
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
      if (companyResource === 'employee_performances') {
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

        companyResourceRef = this._firebase.child('company_' + companyResource + '/' +
          this._companyId + '/' +
          companyResourceObj.employee_id + '/' +
          companyResourceObj.name + '/' +
          (dateFormatPattern != null ? date.format(dateFormatPattern) + '/' : '') +
          (isStats ? '_stats' : ''))

        if (ENVIRONMENT !== 'local') {
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

        val = _.extend(val, { company_id: this._companyId })

        if (companyResource === 'notifications') {
          val = _.omit(val, [ 'company_id', 'updated_date' ])
        }

        companyResourceRef = this._firebase.child('company_' + companyResource + '/' +
          this._companyId + '/' +
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

        if (ENVIRONMENT !== 'local') {
          companyResourceRef.update(val, (error) => {
            if (error) {
              callback(error)
            } else {
              var priority = getPriority(companyResource, companyResourceObj)

              if (priority) {
                this._companyRef.child(companyResource + '/' + companyResourceRef.key()).setWithPriority(true, priority, (error) => {
                  callback(error)
                })
              } else {
                this._companyRef.child(companyResource + '/' + companyResourceRef.key()).set(true, (error) => {
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
}

module.exports = Modules
