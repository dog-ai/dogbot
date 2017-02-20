/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const SocialModule = require('./social-module')

const _ = require('lodash')
const Promise = require('bluebird')

const Bot = require('../../bot')

const moment = require('moment')

const LP = require('linkedin-public-profile-parser')

const _generatePushID = (function () {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'

  // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
  var lastPushTime = 0

  // We generate 72-bits of randomness which get turned into 12 characters and appended to the
  // timestamp to prevent collisions with other clients.  We store the last characters we
  // generated because in the event of a collision, we'll use those same characters except
  // "incremented" by one.
  var lastRandChars = []

  return function () {
    var now = new Date().getTime()
    var duplicateTime = (now === lastPushTime)
    lastPushTime = now

    var timeStampChars = new Array(8)
    for (var i = 7; i >= 0; i--) {
      timeStampChars[ i ] = PUSH_CHARS.charAt(now % 64)
      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64)
    }
    if (now !== 0) throw new Error('We should have converted the entire timestamp.')

    var id = timeStampChars.join('')

    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[ i ] = Math.floor(Math.random() * 64)
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[ i ] === 63; i--) {
        lastRandChars[ i ] = 0
      }
      lastRandChars[ i ]++
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[ i ])
    }
    if (id.length !== 20) throw new Error('Length should be 20.')

    return id
  }
})()

class LinkedIn extends SocialModule {
  constructor () {
    super('linkedin')
  }

  load (config) {
    this.config = config

    super.load()
  }

  start () {
    super.start({
      'social:linkedin:profile:import': this._importProfile.bind(this),
      'social:linkedin:profile:import:auto': this._autoImportProfile.bind(this),
      'social:linkedin:company:import': this._importCompany.bind(this),
      'social:linkedin:company:import:auto': this._autoImportCompany.bind(this)
    })

    Bot.emit('sync:outgoing:quickshot:register', {
      companyResource: 'apps',
      registerEvents: [ 'social:linkedin:config:update' ],
      outgoingFunction: this._onConfigOutgoingSynchronization.bind(this)
    })

    Bot.enqueueJob('social:linkedin:profile:import:auto', null, { schedule: '6 hours' })
    Bot.enqueueJob('social:linkedin:company:import:auto', null, { schedule: '6 hours' })
  }

  stop () {
    Bot.dequeueJob('social:linkedin:profile:import:auto')
    Bot.dequeueJob('social:linkedin:company:import:auto')

    super.stop()
  }

  _onConfigOutgoingSynchronization (params, callback) {
    this.config.updated_date = new Date()

    callback(null, this.config)
  }

  _getLinkedInProfile (linkedInProfileUrl) {
    return new Promise((resolve, reject) => {
      LP.profile(linkedInProfileUrl, (error, profile) => {
        if (error) {
          return reject(error)
        } else {
          return resolve(profile)
        }
      })
    })
  }

  _importProfile (params, callback) {
    var linkedInProfileUrl = params.employee_linkedin_profile_url
    var employeeId = params.employee_id

    const updateEmployeeWithProfile = (employee, profile) => {
      employee.full_name = profile.fullname || employee.full_name
      employee.professional_headline = profile.current || employee.professional_headline
      employee.picture_url = profile.picture || employee.picture_url
      employee.updated_date = new Date()
      employee.linkedin_profile_url = profile.canonicalurl || employee.linkedin_profile_url
      employee.linkedin_last_import_date = new Date()
      employee.is_synced = false

      return employee
    }

    return this._getLinkedInProfile(linkedInProfileUrl)
      .then((profile) => {
        if (employeeId) {
          return this._findEmployeeById(employeeId)
            .then((employee) => {
              if (employee) {
                employee = updateEmployeeWithProfile(employee, profile)

                return this._updateEmployeeById(employee.id, employee)
                  .then(() => {
                    Bot.emit('person:employee:update', employee)
                  })
              }
            })
            .then(() => {
              return profile
            })
        } else if (profile.canonicalurl) {
          return this._findEmployeeByLinkedInProfileUrl(profile.canonicalurl)
            .then((employee) => {
              if (employee) {
                employee = updateEmployeeWithProfile(employee, profile)

                return this._updateEmployeeById(employee.id, employee)
                  .then(() => {
                    Bot.emit('person:employee:update', employee)
                  })
              } else {
                employee = {}
                employee.id = _generatePushID()
                employee.created_date = new Date()
                employee = updateEmployeeWithProfile(employee, profile)

                return this._addEmployee(employee)
                  .then(() => {
                    Bot.emit('person:employee:update', employee)
                  })
              }
            })
            .then(() => {
              return profile
            })
        }
      })
      .then((profile) => {
        return callback(null, profile)
      })
      .catch(callback)
  }

  _autoImportProfile (params, callback) {
    var linkedInLastImportDate = moment().subtract(1, 'week').toDate()

    return this._findAllEmployeesBeforeLinkedInLastImportDate(linkedInLastImportDate)
      .mapSeries((employee) => {
        if (employee.linkedin_profile_url) {
          Bot.enqueueJob('social:linkedin:profile:import', {
            employee_id: employee.id,
            employee_linkedin_profile_url: employee.linkedin_profile_url
          })
        }
      })
      .then(() => {
        callback()
      })
      .catch(callback)
  }

  _importCompany (params, callback) {
    params = params || { app: {} }

    var linkedInCompanyPageUrl = params.app.company_page_url || this.config.company_page_url

    if (!linkedInCompanyPageUrl) {
      return callback()
    }

    LP.company(linkedInCompanyPageUrl, (error, company) => {
      if (error) {
        return callback(error)
      } else {
        var employeeUrls = _.clone(company.employee_urls)

        return Promise.mapSeries(company.employee_urls, (employeeUrl) => {
          return this._getLinkedInProfile(employeeUrl)
            .then((profile) => {
              var employeeRelatedUrls = []

              if (profile.related) {
                for (var i = 0; i < profile.related.length; i++) {
                  if (profile.related[ i ].headline.indexOf(company.name) !== -1) {
                    employeeRelatedUrls.push(profile.related[ i ].url)
                  }
                }
              }

              employeeUrls = _.union(employeeUrls, employeeRelatedUrls)

              var employeeRelatedRelatedUrls = []

              return Promise.mapSeries(employeeRelatedUrls, (relatedEmployeeUrl) => {
                if (!_.includes(employeeUrls, relatedEmployeeUrl)) {
                  return this._getLinkedInProfile(relatedEmployeeUrl)
                    .then((profile) => {
                      if (profile.related) {
                        for (var i = 0; i < profile.related.length; i++) {
                          if (profile.related[ i ].headline.indexOf(company.name) !== -1) {
                            employeeRelatedRelatedUrls.push(profile.related[ i ].url)
                          }
                        }
                      }
                    }).delay(20000)
                }
              })
                .finally(() => {
                  employeeUrls = _.union(employeeUrls, employeeRelatedRelatedUrls)
                })
            })
            .delay(20000)
            .catch(() => {
            })
        })
          .then(() => {
            _.forEach(employeeUrls, (employeeUrl) => {
              Bot.enqueueJob('social:linkedin:profile:import', { employee_linkedin_profile_url: employeeUrl })
            })
          })
          .then(() => {
            this.config.last_import_date = new Date()

            Bot.emit('social:linkedin:config:update')
          })
          .then(() => {
            return callback(null, employeeUrls)
          })
          .catch(callback)
      }
    })
  }

  _autoImportCompany (params, callback) {
    if (!this.config.last_import_date || moment(this.config.last_import_date).isBefore(moment().subtract(1, 'week'))) {
      Bot.enqueueJob('social:linkedin:company:import')
    }

    callback()
  }
}

module.exports = new LinkedIn()
