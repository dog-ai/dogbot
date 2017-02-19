/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const Promise = require('bluebird')

const Bot = require('../../bot')

const { Logger, retry } = require('../../utils')
const Communication = require('../../utils/communication')

class ARP extends MonitorModule {
  constructor () {
    super('arp')
  }

  start () {
    super.start({
      'monitor:arp:discover': this._discover.bind(this),
      'monitor:arp:resolve': this._resolve.bind(this),
      'monitor:arp:reverse': this._reverse.bind(this),
      'monitor:ip:create': this._onIPCreateOrUpdate.bind(this),
      'monitor:ip:update': this._onIPCreateOrUpdate.bind(this),
      'monitor:dhcp:create': this._onDHCPCreateOrUpdate.bind(this),
      'monitor:dhcp:update': this._onDHCPCreateOrUpdate.bind(this)
    })

    const options = { schedule: '1 minute', retry: 6 }
    Bot.enqueueJob('monitor:arp:discover', null, options)
  }

  stop () {
    Bot.dequeueJob('monitor:arp:discover')

    super.stop()
  }

  _onIPCreateOrUpdate (ip) {
    return this._findARPByIPAddress(ip.ip_address)
      .then((arp) => {
        if (!arp) {
          Communication.emit('worker:job:enqueue', 'monitor:arp:resolve', ip.ip_address)
        } else {
          arp.updated_date = new Date()

          return this._updateARPByIPAddressAndMACAddress(arp.ip_address, arp.mac_address, arp)
            .then(() => Communication.emit('monitor:arp:update', arp))
        }
      })
  }

  _onDHCPCreateOrUpdate (dhcp) {
    return this._findARPByMACAddress(dhcp.mac_address)
      .then((arp) => {
        if (!arp) {
          Bot.enqueueJob('monitor:arp:reverse', dhcp.mac_address)
        } else {
          arp.updated_date = new Date()

          return this._updateARPByIPAddressAndMACAddress(arp.ip_address, arp.mac_address, arp)
            .then(() => Communication.emit('monitor:arp:update', arp))
        }
      })
  }

  _discover (params, callback) {
    Communication.emit('monitor:arp:discover:begin')

    return retry(() => this._execArpScan(), {
      timeout: 50000,
      max_tries: -1,
      interval: 1000,
      backoff: 2
    })
      .mapSeries((arp) => {
        return this._createOrUpdateARP(arp)
          .catch((error) => Logger.warn(error))
      })
      .then(this._clean.bind(this))
      .then(() => callback())
      .catch(callback)
      .finally(() => Communication.emit('monitor:arp:discover:finish'))
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

        return this._createOrUpdateARP(arp)
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

        return this._createOrUpdateARP(arp)
      })
      .then(() => callback())
      .catch(callback)
  }

  _clean () {
    const now = new Date()

    return this._deleteAllARPBeforeDate(new Date(new Date().setMinutes(now.getMinutes() - 5)))
      .mapSeries((arp) => Communication.emit('monitor:arp:delete', arp))
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
}

module.exports = new ARP()
