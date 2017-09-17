/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PersonModule = require('./person-module')

const Promise = require('bluebird')

const Server = require('../../server')

const { Person } = require('../../databases')

const Logger = require('modern-logger')

const moment = require('moment')
const macvendor = Promise.promisify(require('macvendor'))

const onArpCreateOrUpdate = (arp) => {
  return Person.macAddresses.find({ where: { address: arp.mac_address } })
    .then((macAddress) => {
      const now = new Date()

      if (macAddress) {
        const wasPresent = macAddress.is_present

        macAddress.is_present = true
        macAddress.last_presence_date = now
        macAddress.is_synced = false

        return macAddress.save()
          .then(() => {
            if (wasPresent) {
              Server.emit('person:mac_address:onlineAgain', macAddress.get({ plain: true }))
            } else {
              Server.emit('person:mac_address:online', macAddress.get({ plain: true }))
            }

            // lookup vendor
            if (macAddress.vendor === undefined || macAddress.vendor === null || macAddress.vendor.length > 60 ||
              macAddress.vendor === macAddress.vendor.toUpperCase() ||
              /(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/gi.test(macAddress.vendor)
            ) {

              return macvendor(macAddress.address)
                .then((vendor) => {
                  if (vendor && vendor.length < 60) {
                    macAddress.vendor = vendor.toLowerCase().replace(/(?:^|\s)\S/g, (s) => s.toUpperCase())
                    macAddress.vendor = macAddress.vendor.replace(/(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/gi, '')
                    macAddress.is_synced = false

                    return macAddress.save()
                  }
                })
            }
          })
      } else {
        macAddress = {
          address: arp.mac_address,
          last_presence_date: now,
          is_present: true,
          is_synced: false
        }

        return Person.macAddresses.create(macAddress)
          .then(() => {
            macAddress.last_presence_date = now
            Server.emit('person:mac_address:online', macAddress.get({ plain: true }))

            // lookup vendor
            return macvendor(macAddress.address)
              .then((vendor) => {
                if (vendor && vendor.length < 60) {
                  macAddress.vendor = vendor.replace(/(?:^|\s)\S/g, (s) => s.toUpperCase())
                  macAddress.vendor = macAddress.vendor.replace(/(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/, '')
                  macAddress.is_synced = false

                  return macAddress.save()
                }
              })
          })
      }
    })
    .catch((error) => Logger.error(error))
}

const onArpDelete = (arp) => {
  return Person.macAddresses.find({ where: { address: arp.mac_address } })
    .then((macAddress) => {
      if (macAddress) {
        macAddress.is_present = false
        macAddress.is_synced = false
        macAddress.last_presence_date = arp.updated_date

        return macAddress.save()
          .then(() => Server.emit('person:mac_address:offline', macAddress.get({ plain: true })))
      }

    })
    .catch((error) => Logger.error(error))
}

const removeOldMacAddresses = (params, callback) => {
  return Person.macAddresses.find({
    where: {
      last_presence_date: { $lte: moment().subtract(1, 'month').toDate() },
      device_id: { $ne: null }
    }
  })
    .mapSeries((macAddress) => {
      macAddress.is_to_be_deleted = true
      macAddress.is_synced = false

      return macAddress.save()
    })
    .then(() => callback())
    .catch((error) => callback(error))
}

class MacAddress extends PersonModule {
  constructor () {
    super('mac-address')
  }

  start () {
    super.start({
      'person:macAddress:clean': removeOldMacAddresses,
      'monitor:arp:create': onArpCreateOrUpdate,
      'monitor:arp:update': onArpCreateOrUpdate,
      'monitor:arp:delete': onArpDelete
    })

    const options = { schedule: '6 hours' }
    Server.enqueueJob('person:macAddress:clean', null, options)
  }

  stop () {
    super.stop()

    Server.dequeueJob('person:macAddress:clean')
  }
}

module.exports = new MacAddress()
