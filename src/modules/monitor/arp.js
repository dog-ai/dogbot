/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')
const retry = require('bluebird-retry')

const Logger = require('../../utils/logger.js')

const utils = require('../utils.js')

class ARP {
  constructor () {
    this.type = 'monitor'
    this.name = 'arp'
    this.events = {}
  }

  info () {
    return '*' + this.name + '* - ' +
      '_' + this.name.toUpperCase() + ' ' +
      this.type.toLowerCase() + ' module_'
  }

  load (communication) {
    this.communication = communication

    this.start()
  }

  unload () {
    this.stop()
  }

  start () {
    utils.startListening.bind(this)({
      'monitor:arp:discover': this._discover.bind(this),
      'monitor:arp:resolve': this._resolve.bind(this),
      'monitor:arp:reverse': this._reverse.bind(this),
      'monitor:ip:create': this._onIPCreateOrUpdate.bind(this),
      'monitor:ip:update': this._onIPCreateOrUpdate.bind(this),
      'monitor:dhcp:create': this._onDHCPCreateOrUpdate.bind(this),
      'monitor:dhcp:update': this._onDHCPCreateOrUpdate.bind(this)
    })

    this.communication.emit('worker:job:enqueue', 'monitor:arp:discover', null, {
      schedule: '1 minute',
      retry: 6
    })
  }

  stop () {
    this.communication.emit('worker:job:dequeue', 'monitor:arp:discover')

    utils.stopListening.bind(this)([
      'monitor:arp:discover',
      'monitor:arp:resolve',
      'monitor:ip:create',
      'monitor:ip:update',
      'monitor:dhcp:create',
      'monitor:dhcp:update'
    ])
  }

  _onIPCreateOrUpdate (ip) {
    return this._findByIPAddress(ip.ip_address)
      .then((arp) => {
        if (!arp) {
          this.communication.emit('worker:job:enqueue', 'monitor:arp:resolve', ip.ip_address)
        } else {
          arp.updated_date = new Date()

          return this._updateByIPAddressAndMACAddress(arp.ip_address, arp.mac_address, arp)
            .then(() => this.communication.emit('monitor:arp:update', arp))
        }
      })
  }

  _onDHCPCreateOrUpdate (dhcp) {
    return this._findByMACAddress(dhcp.mac_address)
      .then((arp) => {
        if (!arp) {
          this.communication.emit('worker:job:enqueue', 'monitor:arp:reverse', dhcp.mac_address)
        } else {
          arp.updated_date = new Date()

          return this._updateByIPAddressAndMACAddress(arp.ip_address, arp.mac_address, arp)
            .then(() => this.communication.emit('monitor:arp:update', arp))
        }
      })
  }

  _discover (params, callback) {
    this.communication.emit('monitor:arp:discover:begin')

    return retry(() => this._execArpScan(), { max_tries: 3, interval: 1000 })
      .mapSeries((arp) => {
        return this._createOrUpdate(arp)
          .catch((error) => Logger.warn(error))
      })
      .then(this._clean.bind(this))
      .then(() => callback())
      .catch(callback)
      .finally(() => this.communication.emit('monitor:arp:discover:finish'))
  }

  _reverse (macAddress, callback) {
    return retry(() => this._execReverseArp(macAddress), { max_tries: 3, interval: 1000 })
      .then((ipAddress) => {
        if (!ipAddress) {
          return
        }

        const arp = {
          ip_address: ipAddress,
          mac_address: macAddress
        }

        return this._createOrUpdate(arp)
      })
      .then(() => callback())
      .catch(callback)
  }

  _resolve (ipAddress, callback) {
    return retry(() => this._execArp(ipAddress), { max_tries: 3, interval: 1000 })
      .then((macAddress) => {
        if (!macAddress) {
          return
        }

        const arp = {
          ip_address: ipAddress,
          mac_address: macAddress
        }

        return this._createOrUpdate(arp)
      })
      .then(() => callback())
      .catch(callback)
  }

  _clean () {
    const now = new Date()

    return this._deleteAllBeforeDate(new Date(new Date().setMinutes(now.getMinutes() - 5)))
      .mapSeries((arp) => this.communication.emit('monitor:arp:delete', arp))
  }

  _execArpScan () {
    return new Promise((resolve, reject) => {
      const result = []

      const _interface = process.platform === 'linux' ? 'wlan0' : 'en0'

      const spawn = require('child_process').spawn
      const _process = spawn('arp-scan', [
        '--interface=' + _interface,
        '--localnet',
        '--numeric', // IP addresses only, no hostnames.
        '--quiet',
        '--ignoredups', // Don't display duplicate packets.
        '--timeout=1000', // Set initial per host timeout to ms.
        '--retry=4',
        '--plain' // Display plain output showing only responding hosts.
      ])

      _process.stdout.setEncoding('utf8')
      _process.stdout.pipe(require('split')()).on('data', (line) => {
        const values = line.split('\t')

        const arp = {
          ip_address: values[ 0 ],
          mac_address: values[ 1 ]
        }

        if (arp.ip_address && arp.ip_address.length > 0 &&
          arp.mac_address && arp.mac_address.length > 0) {
          result.push(arp)
        }
      })

      _process.stderr.on('data', (data) => reject(new Error(data)))

      _process.on('error', reject)
      _process.on('close', () => resolve(result))
    })
  }

  _execReverseArp (macAddress) {
    return new Promise((resolve, reject) => {
      var result

      var spawn = require('child_process').spawn
      var arp = spawn('arp', [ '-an' ])
      var _process = spawn('grep', [ macAddress ])

      arp.stdout.pipe(_process.stdin)

      _process.stdout.setEncoding('utf8')
      _process.stdout.pipe(require('split')()).on('data', (line) => {
        if (!line || line.length === 0) {

        } else {
          var ipAddress = line.split(' ')[ 1 ].replace(/[\(\)]/g, '')

          if (!/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(ipAddress)) {
            ipAddress = undefined
          }

          result = ipAddress
        }
      })

      _process.stderr.on('data', (data) => {
        reject(new Error(data))
      })

      _process.on('error', reject)
      _process.on('close', () => {
        resolve(result)
      })
    })
  }

  _execArp (ipAddress) {
    return new Promise((resolve, reject) => {
      var result

      var spawn = require('child_process').spawn
      var _process = spawn('arp', [ '-n', ipAddress ])

      _process.stdout.setEncoding('utf8')
      _process.stdout.pipe(require('split')()).on('data', (line) => {
        if (line !== null && line.length === 0 || line.lastIndexOf('A', 0) === 0) {

        } else {
          var values = line.replace(/\s\s+/g, ' ').split(' ')

          var macAddress
          if (process.platform === 'linux') {
            macAddress = values[ 2 ]
          } else {
            macAddress = values[ 3 ]

            if (macAddress.indexOf(':') > -1) { // fix malformed MAC addresses coming from OSX arp binary
              values = macAddress.split(':')
              macAddress = ''
              for (var i = 0; i < values.length; i++) {
                if (values[ i ].length === 1) {
                  values[ i ] = '0' + values[ i ]
                }

                if (macAddress !== '') {
                  macAddress += ':'
                }

                macAddress += values[ i ]
              }
            }
          }

          if (!/^(([a-f0-9]{2}:){5}[a-f0-9]{2},?)+$/i.test(macAddress)) {
            macAddress = undefined
          }

          result = macAddress
        }
      })

      _process.stderr.on('data', (data) => {
        reject(new Error(data))
      })

      _process.on('error', reject)
      _process.on('close', () => {
        resolve(result)
      })
    })
  }

  _createOrUpdate (arp) {
    return this._findByIPAddress(arp.ip_address)
      .then((row) => {
        if (!row) {
          return this._create(arp.ip_address, arp.mac_address, arp)
            .then(() => {
              this.communication.emit('monitor:arp:create', arp)
            })
        } else {
          row.updated_date = new Date()

          return this._updateByIPAddressAndMACAddress(row.ip_address, row.mac_address, row)
            .then(() => {
              this.communication.emit('monitor:arp:update', row)
            })
        }
      })
  }

  _create (ipAddress, macAddress, arp) {
    var _arp = _.clone(arp)

    if (_arp.created_date && _arp.created_date instanceof Date) {
      _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_arp.updated_date && _arp.updated_date instanceof Date) {
      _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_arp)
    var values = _.values(_arp)

    return this.communication.emitAsync('database:monitor:create',
      'INSERT INTO arp (' + keys + ') VALUES (' + values.map(() => {
        return '?'
      }) + ')',
      values
    )
  }

  _updateByIPAddressAndMACAddress (ipAddress, macAddress, arp) {
    var _arp = _.clone(arp)

    if (_arp.created_date && _arp.created_date instanceof Date) {
      _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_arp.updated_date && _arp.updated_date instanceof Date) {
      _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_arp)
    var values = _.values(_arp)

    return this.communication.emitAsync('database:monitor:update',
      'UPDATE arp SET ' + keys.map((key) => {
        return key + ' = ?'
      }) + ' WHERE ip_address = \'' + ipAddress + '\' AND mac_address = \'' + macAddress + '\'',
      values
    )
  }

  _findByIPAddress (ipAddress) {
    return this.communication.emitAsync('database:monitor:retrieveOne', 'SELECT * FROM arp WHERE ip_address = ?', [ ipAddress ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
        }
        return row
      })
  }

  _findByMACAddress (macAddress) {
    return this.communication.emitAsync('database:monitor:retrieveOne', 'SELECT * FROM arp WHERE mac_address = ?', [ macAddress ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
        }
        return row
      })
  }

  _deleteAllBeforeDate (date) {
    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '')

    return this.communication.emitAsync('database:monitor:retrieveAll', 'SELECT * FROM arp WHERE updated_date < Datetime(?)', [ updatedDate ])
      .then((rows) => {
        return Promise.mapSeries(rows, (row) => {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))

          return this.communication.emitAsync('database:monitor:delete', 'DELETE FROM arp WHERE id = ?', [ row.id ])
        })
          .then(() => {
            return rows
          })
      })
  }
}

module.exports = new ARP()
