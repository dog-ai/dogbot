/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const Module = require('../module')

const Communication = require('../../utils/communication')

class MonitorModule extends Module {
  constructor (name) {
    super('monitor', name)

    this.events = {}
  }

  _createOrUpdateARP (arp) {
    return this._findARPByIPAddress(arp.ip_address)
      .then((row) => {
        if (!row) {
          return this._createARP(arp.ip_address, arp.mac_address, arp)
            .then(() => {
              Communication.emit('monitor:arp:create', arp)
            })
        } else {
          row.updated_date = new Date()

          return this._updateARPByIPAddressAndMACAddress(row.ip_address, row.mac_address, row)
            .then(() => {
              Communication.emit('monitor:arp:update', row)
            })
        }
      })
  }

  _createARP (ipAddress, macAddress, arp) {
    var _arp = _.clone(arp)

    if (_arp.created_date && _arp.created_date instanceof Date) {
      _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_arp.updated_date && _arp.updated_date instanceof Date) {
      _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_arp)
    var values = _.values(_arp)

    return Communication.emitAsync('database:monitor:create',
      'INSERT INTO arp (' + keys + ') VALUES (' + values.map(() => {
        return '?'
      }) + ')',
      values
    )
  }

  _updateARPByIPAddressAndMACAddress (ipAddress, macAddress, arp) {
    var _arp = _.clone(arp)

    if (_arp.created_date && _arp.created_date instanceof Date) {
      _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_arp.updated_date && _arp.updated_date instanceof Date) {
      _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_arp)
    var values = _.values(_arp)

    return Communication.emitAsync('database:monitor:update',
      'UPDATE arp SET ' + keys.map((key) => {
        return key + ' = ?'
      }) + ' WHERE ip_address = \'' + ipAddress + '\' AND mac_address = \'' + macAddress + '\'',
      values
    )
  }

  _findARPByIPAddress (ipAddress) {
    return Communication.emitAsync('database:monitor:retrieveOne', 'SELECT * FROM arp WHERE ip_address = ?', [ ipAddress ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
        }
        return row
      })
  }

  _findARPByMACAddress (macAddress) {
    return Communication.emitAsync('database:monitor:retrieveOne', 'SELECT * FROM arp WHERE mac_address = ?', [ macAddress ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
        }
        return row
      })
  }

  _deleteAllARPBeforeDate (date) {
    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '')

    return Communication.emitAsync('database:monitor:retrieveAll', 'SELECT * FROM arp WHERE updated_date < Datetime(?)', [ updatedDate ])
      .then((rows) => {
        return Promise.mapSeries(rows, (row) => {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))

          return Communication.emitAsync('database:monitor:delete', 'DELETE FROM arp WHERE id = ?', [ row.id ])
        })
          .then(() => {
            return rows
          })
      })
  }

  _createOrUpdateBonjour (bonjour) {
    return this._findBonjourByTypeAndName(bonjour.type, bonjour.name)
      .then((row) => {
        if (row === undefined) {
          return this._createBonjour(bonjour)
            .then(() => {
              return Communication.emitAsync('monitor:bonjour:create', bonjour)
            })
        } else {
          bonjour.updated_date = new Date()
          return this._updateBonjourByTypeAndName(bonjour.type, bonjour.name, bonjour)
            .then(() => {
              return Communication.emitAsync('monitor:bonjour:update', bonjour)
            })
        }
      })
  }

  _createBonjour (bonjour) {
    var _bonjour = _.clone(bonjour)

    if (_bonjour.created_date !== undefined && _bonjour.created_date !== null && _bonjour.created_date instanceof Date) {
      _bonjour.created_date = _bonjour.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_bonjour.updated_date !== undefined && _bonjour.updated_date !== null && _bonjour.updated_date instanceof Date) {
      _bonjour.updated_date = _bonjour.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_bonjour)
    var values = _.values(_bonjour)

    return Communication.emitAsync('database:monitor:create',
      'INSERT INTO bonjour (' + keys + ') VALUES (' + values.map(() => {
        return '?'
      }) + ')',
      values)
      .then(() => {
        return _bonjour
      })
  }

  _findBonjourByTypeAndName (type, name) {
    return Communication.emitAsync('database:monitor:retrieveOne',
      'SELECT * FROM bonjour WHERE type = ? AND name = ?', [ type, name ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
        }
        return row
      })
  }

  _updateBonjourByTypeAndName (type, name, bonjour) {
    var _bonjour = _.clone(bonjour)

    if (_bonjour.created_date !== undefined && _bonjour.created_date !== null && _bonjour.created_date instanceof Date) {
      _bonjour.created_date = _bonjour.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_bonjour.updated_date !== undefined && _bonjour.updated_date !== null && _bonjour.updated_date instanceof Date) {
      _bonjour.updated_date = _bonjour.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_bonjour)
    var values = _.values(_bonjour)

    // TODO: Fix this query by http://stackoverflow.com/questions/603572/how-to-properly-escape-a-single-quote-for-a-sqlite-database
    return Communication.emitAsync('database:monitor:update',
      'UPDATE bonjour SET ' + keys.map((key) => {
        return key + ' = ?'
      }) + ' WHERE type = \'' + type + '\' AND name = \'' + name + '\'',
      values)
  }

  _deleteAllBonjourBeforeDate (oldestDate) {
    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '')

    return Communication.emitAsync('database:monitor:retrieveAll', 'SELECT * FROM bonjour WHERE updated_date < Datetime(?)', [ updatedDate ])
      .then((rows) => {
        return Promise.mapSeries(rows, (row) => {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))

          return Communication.emitAsync('database:monitor:delete', 'DELETE FROM bonjour WHERE id = ?', [ row.id ])
        })
          .then(() => {
            return rows
          })
      })
  }
}

module.exports = MonitorModule
