/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PersonModule = require('./person-module')

const _ = require('lodash')

const Server = require('../../server')

const { Person } = require('../../databases')

const Logger = require('modern-logger')

const onDeviceOnline = (device) => {
  if (device.employee_id) {
    return Person.employees.findById(device.employee_id)
      .then((employee) => {
        if (employee !== undefined && !employee.is_present) {
          employee.is_present = true
          employee.last_presence_date = device.last_presence_date
          employee.is_synced = false

          return employee.save()
            .then(() => {
              Server.emit('person:employee:nearby', employee.get({ plain: true }))
              Server.emit('person:employee:update', employee.get({ plain: true }))
            })
        }
      })
      .catch((error) => Logger.error(error))
  }
}

const onDeviceOnlineAgain = (device) => {
  if (device.employee_id) {
    return Person.employees.findById(device.employee_id)
      .then((employee) => {
        if (employee) {
          employee.last_presence_date = device.last_presence_date
          employee.is_synced = false
          return employee.save()
        }
      })
      .catch((error) => Logger.error(error))
  }
}

const onDeviceOffline = (device) => {
  if (device.employee_id) {
    return Person.employees.findById(device.employee_id)
      .then((employee) => {
        if (employee) {
          // only emit farway if the employee does not have any other device online
          return Person.devices.findAll({ where: { employee_id: employee.id, is_present: true } })
            .then((devices) => {
              if (_.isEmpty(devices) && employee.is_present) {

                employee.is_present = false
                employee.last_presence_date = device.last_presence_date
                employee.is_synced = false

                return employee.save()
                  .then(() => {
                    Server.emit('person:employee:faraway', employee.get({ plain: true }))
                    Server.emit('person:employee:update', employee.get({ plain: true }))
                  })
              }
            })
        }
      })
      .catch((error) => Logger.error(error))
  }
}

const isPresent = (employee, callback) => {
  const onArpDiscover = () => {
    Server.removeListener('monitor:arp:discover:finish', onArpDiscover)

    return Person.devices.findAll({ where: { employee_id: employee.id } })
      .then((devices) => {
        if (devices) {
          const device = _.find(devices, { 'is_present': true })
          callback(!!device)
        }
      })
      .catch(callback(error))
  }

  Server.on('monitor:arp:discover:finish', onArpDiscover)
}

const onDeviceAddedToEmployee = (device, employee) => {
  return Person.employees.findById(employee.id)
    .then((employee) => {
      if (device.is_present && employee && !employee.is_present) {
        employee.is_present = true
        employee.last_presence_date = device.last_presence_date

        return employee.save()
          .then(() => {
            Server.emit('person:employee:nearby', employee.get({ plain: true }))
            Server.emit('person:employee:update', employee.get({ plain: true }))
          })
      }
    })
    .catch((error) => Logger.error(error))
}

const onDeviceRemovedFromEmployee = (device, employee) => {
  return Person.employees.findById(employee.id)
    .then((employee) => {
      if (employee) {
        // only emit farway if the employee does not have any other device online
        return Person.devices.findAll({ where: { employee_id: employee.id, is_present: true } })
          .then((devices) => {
            if (devices && _.isEmpty(devices) && employee.is_present) {

              employee.is_present = false
              employee.last_presence_date = device.last_presence_date

              return employee.save()
                .then(() => {
                  Server.emit('person:employee:faraway', employee.get({ plain: true }))
                  Server.emit('person:employee:update', employee.get({ plain: true }))
                })
            }
          })
      }
    })
    .catch((error) => Logger.error(error))
}

class Employee extends PersonModule {
  constructor () {
    super('person')
  }

  start () {
    super.start({
      'person:device:online': onDeviceOnline,
      'person:device:onlineAgain': onDeviceOnlineAgain,
      'person:device:offline': onDeviceOffline,
      'person:device:addedToEmployee': onDeviceAddedToEmployee,
      'person:device:removedFromEmployee': onDeviceRemovedFromEmployee,
      'person:slack:active': () => {},
      'person:slack:away': () => {},
      'person:employee:is_present': isPresent
    })
  }

  stop () {
    this.stop()

    Server.removeAllListeners('monitor:arp:discover:finish')
  }
}

module.exports = new Employee
