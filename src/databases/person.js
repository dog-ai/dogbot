/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Database = require('./database')

const _ = require('lodash')

const Server = require('../server')

const Logger = require('modern-logger')

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

const Sequelize = require('sequelize')

const moment = require('moment')

const { join } = require('path')

const onCreateOrUpdateEmployeeIncomingSynchronization = function (employee) {
  return this._models.employee.findById(employee.id)
    .then((_employee) => {
      if (!_employee) {
        return this._models.employee.create(employee)
      }

      if (moment(employee.updated_date).isAfter(_employee.updated_date)) {
        _employee = _.merge(_employee, _.omit(employee, 'is_present', 'last_presence_date'))

        return _employee.save()
      }
    })
    .catch((error) => Logger.error(error))
}

const onDeleteEmployeeIncomingSynchronization = function (employee) {
  return this._models.employee.findById(employee.id)
    .then((employee) => {
      if (employee) {
        return employee.destroy()
          .then(() => {
            if (employee.is_present) {
              Server.emit('person:employee:faraway', employee)
            }
          })
      }
    })
    .catch((error) => Logger.error(error))
}

const onEmployeeOutgoingSynchronization = function (params, callback) {
  const employeeId = _.get(params, 'id')

  return this._models.employee.findAll({ where: { id: employeeId, is_synced: false } })
    .mapSeries((employee) => {
      return this._models.device.findAll({ where: { employee_id: employee.id } })
        .then((devices) => {
          employee.devices = {}

          _.forEach(devices, (device) => {
            employee.devices[ device.id ] = true
          })

          callback(null, employee, (error) => {
            if (error) {
              return Logger.error(error)
            }

            delete employee.devices

            employee.is_synced = true

            return employee.save()
          })
        })
    })
    .catch(callback)
}

const onCreateOrUpdateDeviceIncomingSynchronization = function (device) {
  return this._models.device.findById(device.id)
    .then((row) => {
      if (row) {

        if (moment(device.updated_date).isAfter(row.updated_date)) {

          if (row.employee_id !== null && device.employee_id === undefined) {
            device.employee_id = null
          }

          row = _.merge(row, _.omit(device, 'is_present', 'last_presence_date'))

          return row.save()
            .then(() => {
              device = _.extend(device, {
                is_present: row.is_present,
                last_presence_date: row.last_presence_date
              })

              if (row.employee_id !== null && device.employee_id === null) {
                Server.emit('person:device:removedFromEmployee', device, { id: row.employee_id })
              } else if (row.employee_id === null && device.employee_id !== null) {
                Server.emit('person:device:addedToEmployee', device, { id: device.employee_id })
              }
            })
        }
      } else {
        return this._models.device.create(device)
          .then((device) => {
            if (device.is_present) {
              return isPresent(device)
                .then((is_present) => {
                  if (!is_present) {
                    device.updated_date = new Date()
                    device.is_present = false
                    device.is_synced = false

                    return device.save()
                      .then(() => Server.emit('person:device:offline', device.get({ plain: true })))
                  }
                })
            }
          })
      }
    })
    .catch((error) => Logger.error(error))
}

const onDeleteDeviceIncomingSynchronization = function (device) {
  return this._models.device.findById(device.id)
    .then((device) => {
      if (device) {
        return device.destroy()
          .then(() => {
            if (device.is_present) {
              device.is_to_be_deleted = true

              Server.emit('person:device:offline', device.get({ plain: true }))
            }
          })
      }
    })
    .catch((error) => Logger.error(error))
}

const onDeviceOutgoingSynchronization = function (params, callback) {
  const deviceId = _.get(params, 'id')

  this._models.device.find({ where: { id: deviceId, is_synced: false } })
    .then((device) => {
      if (device) {
        device.created_date = new Date(device.created_date.replace(' ', 'T'))
        device.updated_date = new Date(device.updated_date.replace(' ', 'T'))
        device.last_presence_date = new Date(device.last_presence_date.replace(' ', 'T'))
        device.is_present = row.is_present === 1
        device.is_manual = row.is_manual === 1

        return Person.macAddresses.findAll({ where: { device_id: device.id } })
          .then((macAddresses) => {
            device.mac_addresses = {}

            _.forEach(macAddresses, (macAddress) => {
              device.mac_addresses[ macAddress.id ] = true
            })

            callback(null, row, function (error) {
              if (error) {
                Logger.error(error)
              } else {
                delete device.mac_addresses

                device.is_synced = true

                device.save()
                  .catch((error) => Logger.error(error))
              }
            })
          })
      }
    })
}

const onMacAddressOutgoingSynchronization = function (params, callback) {
  const macAddressId = _.get(params, 'id')

  return this._models[ 'mac_address' ].findAll({ where: { id: macAddressId, is_synced: false } })
    .mapSeries((macAddress) => {
      callback(null, macAddress.get({ plain: true }), (error, _macAddress) => {
        if (error) {
          Logger.error(error)

          return
        }

        if (_macAddress.is_to_be_deleted) {
          macAddress.destroy()
            .catch((error) => Logger.error(error))

          return
        }

        macAddress.id = _macAddress.id
        macAddress.is_synced = true

        macAddress.save()
          .catch((error) => Logger.error(error))
      })
    })
    .catch((error) => Logger.error(error))
}

const onCreateOrUpdateMacAddressIncomingSynchronization = function (macAddress) {
  macAddress.is_synced = true

  return this._models[ 'mac_address' ].find({ where: { address: macAddress.address } })
    .then((_macAddress) => {
      if (_macAddress) {
        if (moment(macAddress.updated_date).isAfter(_macAddress.updated_date)) {
          if (_macAddress.device_id && !macAddress.device_id) {
            _macAddress.device_id = null
          }

          return _macAddress.save()
        }
      } else {
        return this._models[ 'mac_address' ].create(macAddress)
      }
    })
    .catch((error) => Logger.error(error))
}

const onDeleteMacAddressIncomingSynchronization = function (macAddress) {
  return this._models[ 'mac_address' ].findById(macAddress.id)
    .then((macAddress) => {
      return macAddress.destroy()
        .then(() => {
          if (macAddress.is_present) {
            Server.emit('person:mac_address:offline', macAddress.get({ plain: true }))
          }
        })
    })
    .catch((error) => Logger.error(error))
}

const onDeviceDiscoverCreateMacAddress = function (device, callback) {
  return this._models[ 'mac_address' ].findAll({ where: { device_id: device.id } })
    .mapSeries((macAddress) => onMacAddressOutgoingSynchronization(macAddress, callback))
}

const onDeviceDiscoverCreateNotification = function (device, callback) {
  Logger.info('Discovered device ' + device.name)

  const notification = {
    id: _generatePushID(),
    created_date: moment(),
    app: 'presence',
    module: 'device',
    device: device.id,
    message: 'Discovered device ' + device.name
  }

  callback(null, notification)
}

const defaultOptions = {
  database: { name: 'person' },
  sequelize: {
    pathDir: join(__dirname, '../../var/tmp'),
    filename: 'person.db'
  }
}

class Person extends Database {
  constructor (options = {}) {
    super(_.defaultsDeep(options, defaultOptions))

    this._models = {
      employee: this._sequelize.define('employee', {
        id: { primaryKey: true, type: Sequelize.TEXT, allowNull: false },
        full_name: { type: Sequelize.TEXT, allowNull: false },
        is_present: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        slack_id: { type: Sequelize.TEXT },
        last_presence_date: { type: Sequelize.DATE },
        is_synced: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        linkedin_profile_url: { type: Sequelize.TEXT },
        linkedin_last_import: { type: Sequelize.DATE },
        professional_headline: { type: Sequelize.TEXT },
        picture_url: { type: Sequelize.TEXT }
      }, { underscored: true, createdAt: 'created_date', updatedAt: 'updated_date' }),
      device: this._sequelize.define('device', {
        id: { primaryKey: true, type: Sequelize.TEXT, defaultValue: null },
        employee_id: { type: Sequelize.TEXT },
        is_present: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        is_manual: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        last_presence_date: { type: Sequelize.DATE },
        is_synced: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        name: { type: Sequelize.TEXT },
        type: { type: Sequelize.TEXT },
        os: { type: Sequelize.TEXT },
        manufacturer: { type: Sequelize.TEXT }
      }, { underscored: true, createdAt: 'created_date', updatedAt: 'updated_date' }),
      mac_address: this._sequelize.define('mac_address', {
        id: { primaryKey: true, type: Sequelize.TEXT, defaultValue: null },
        address: { type: Sequelize.TEXT },
        device_id: { type: Sequelize.TEXT },
        is_present: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        last_presence_date: { type: Sequelize.DATE },
        is_synced: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        is_to_be_deleted: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        last_scan_date: { type: Sequelize.DATE },
        vendor: { type: Sequelize.TEXT }
      }, { underscored: true, createdAt: 'created_date', updatedAt: 'updated_date' })
    }
  }

  get models () {
    return this._models
  }

  get employees () {
    return this._models[ 'employee' ]
  }

  get devices () {
    return this._models[ 'device' ]
  }

  get macAddresses () {
    return this._models[ 'mac_address' ]
  }

  start () {
    const events = {
      'sync:incoming:person:employee:create': onCreateOrUpdateEmployeeIncomingSynchronization.bind(this),
      'sync:incoming:person:employee:update': onCreateOrUpdateEmployeeIncomingSynchronization.bind(this),
      'sync:incoming:person:employee:delete': onDeleteEmployeeIncomingSynchronization.bind(this),
      'sync:outgoing:person:employee': onEmployeeOutgoingSynchronization.bind(this),

      'sync:incoming:person:device:create': onCreateOrUpdateDeviceIncomingSynchronization.bind(this),
      'sync:incoming:person:device:update': onCreateOrUpdateDeviceIncomingSynchronization.bind(this),
      'sync:incoming:person:device:delete': onDeleteDeviceIncomingSynchronization.bind(this),
      'sync:outgoing:person:device': onDeviceOutgoingSynchronization.bind(this),

      'sync:incoming:person:macAddress:create': onCreateOrUpdateMacAddressIncomingSynchronization.bind(this),
      'sync:incoming:person:macAddress:update': onCreateOrUpdateMacAddressIncomingSynchronization.bind(this),
      'sync:incoming:person:macAddress:delete': onDeleteMacAddressIncomingSynchronization.bind(this),
      'sync:outgoing:person:mac_address': onMacAddressOutgoingSynchronization.bind(this),
    }

    return super.start(events)
      .then(() => {
        Server.emitAsync('sync:incoming:register:setup', {
          companyResource: 'employees',
          onCompanyResourceAddedCallback: (employee) => Server.emit('sync:incoming:person:employee:create', employee),
          onCompanyResourceChangedCallback: (employee) => Server.emit('sync:incoming:person:employee:update', employee),
          onCompanyResourceRemovedCallback: (employee) => Server.emit('sync:incoming:person:employee:delete', employee)
        })

        Server.emitAsync('sync:outgoing:periodic:register', {
          companyResource: 'employees',
          event: 'sync:outgoing:person:employee'
        })

        Server.emit('sync:outgoing:quickshot:register', {
          companyResource: 'employees',
          registerEvents: [ 'person:employee:update' ],
          outgoingEvent: 'sync:outgoing:person:employee'
        })

        Server.emitAsync('sync:incoming:register:setup', {
          companyResource: 'devices',
          onCompanyResourceAddedCallback: (device) => Server.emit('sync:incoming:person:device:create', device),
          onCompanyResourceChangedCallback: (device) => Server.emit('sync:incoming:person:device:update', device),
          onCompanyResourceRemovedCallback: (device) => Server.emit('sync:incoming:person:device:delete', device)
        })

        Server.emitAsync('sync:outgoing:periodic:register', {
          companyResource: 'devices',
          event: 'sync:outgoing:person:device'
        })

        Server.emit('sync:outgoing:quickshot:register', {
          companyResource: 'devices',
          registerEvents: [ 'person:device:online', 'person:device:offline', 'person:device:discover:create' ],
          outgoingEvent: 'sync:outgoing:person:device'
        })

        Server.emitAsync('sync:incoming:register:setup', {
          companyResource: 'mac_addresses',
          onCompanyResourceAddedCallback: (macAddress) => Server.emit('sync:incoming:person:macAddress:create', macAddress),
          onCompanyResourceChangedCallback: (macAddress) => Server.emit('sync:incoming:person:macAddress:update', macAddress),
          onCompanyResourceRemovedCallback: (macAddress) => Server.emit('sync:incoming:person:macAddress:delete', macAddress)
        })

        Server.emitAsync('sync:outgoing:periodic:register', {
          companyResource: 'mac_addresses',
          event: 'sync:outgoing:person:mac_address'
        })

        Server.emit('sync:outgoing:quickshot:register', {
          companyResource: 'mac_addresses',
          registerEvents: [ 'person:device:discover:create' ],
          outgoingFunction: onDeviceDiscoverCreateMacAddress.bind(this)
        })

        Server.emit('sync:outgoing:quickshot:register', {
          companyResource: 'notifications',
          registerEvents: [ 'person:device:discover:create' ],
          outgoingFunction: onDeviceDiscoverCreateNotification.bind(this)
        })
      })
  }
}

module.exports = new Person()
