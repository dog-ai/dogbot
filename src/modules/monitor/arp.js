/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const Promise = require('bluebird')

const Server = require('../../server')

const { Monitor } = require('../../databases')

const { retry } = require('../../utils')

const execArpScan = function () {
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

const execReverseArp = function (macAddress) {
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
      if (!result) {
        return reject(new Error('unable to reverse'))
      }

      resolve(result)
    })
  })
}

const execArp = function (ipAddress) {
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

class Arp extends MonitorModule {
  constructor () {
    super('arp')
  }

  start () {
    super.start({
      'monitor:arp:discover': this.discover.bind(this),
      'monitor:arp:resolve': this.resolve.bind(this),
      'monitor:arp:reverse': this.reverse.bind(this),
      'monitor:ip:create': this.createOrUpdateFromIp.bind(this),
      'monitor:ip:update': this.createOrUpdateFromIp.bind(this),
      'monitor:dhcp:create': this.createOrUpdateFromDhcp.bind(this),
      'monitor:dhcp:update': this.createOrUpdateFromDhcp.bind(this)
    })

    Server.enqueueJob('monitor:arp:discover', null, { schedule: '1 minute', retry: 6 })
  }

  stop () {
    Server.dequeueJob('monitor:arp:discover')
    Server.dequeueJob('monitor:arp:resolve')
    Server.dequeueJob('monitor:arp:reverse')

    super.stop()
  }

  discover (params, callback) {
    Server.emit('monitor:arp:discover:begin')

    return retry(() => execArpScan(), { timeout: 50000, max_tries: -1, interval: 1000, backoff: 2 })
      .then((arps) => super.discover(arps, [ 'ip_address', 'mac_address' ], new Date(new Date().setMinutes(new Date().getMinutes() - 5))))
      .then(() => callback())
      .catch((error) => callback(error))
      .finally(() => Server.emit('monitor:arp:discover:finish'))
  }

  resolve (ipAddress, callback) {
    return retry(() => execArp(ipAddress), { max_tries: 3, interval: 1000 })
      .then((macAddress) => super.discover([ {
        ip_address: ipAddress,
        mac_address: macAddress
      } ], [ 'ip_address', 'mac_address' ], new Date(new Date().setMinutes(new Date().getMinutes() - 5))))
      .then(() => callback())
      .catch(() => callback(error))
  }

  reverse (macAddress, callback) {
    return retry(() => execReverseArp(macAddress), { max_tries: 3, interval: 1000 })
      .then((ipAddress) => super.discover([ {
        ip_address: ipAddress,
        mac_address: macAddress
      } ], [ 'ip_address', 'mac_address' ], new Date(new Date().setMinutes(new Date().getMinutes() - 5))))
      .then(() => callback())
      .catch(() => callback(error))
  }

  createOrUpdateFromIp (ip) {
    return Monitor.arp.findOne({ where: { ip_address: ip.ip_address } })
      .then((arp) => {
        if (!arp) {
          Server.enqueueJob('monitor:arp:resolve', ip.ip_address)

          return
        }

        arp.changed('updated_date', true)

        return arp.save()
          .then(() => Server.emit('monitor:arp:update', arp.get({ plain: true })))
      })
  }

  createOrUpdateFromDhcp (dhcp) {
    return Monitor.arp.findOne({ where: { mac_address: dhcp.mac_address } })
      .then((arp) => {
        if (!arp) {
          Server.enqueueJob('monitor:arp:reverse', dhcp.mac_address)

          return
        }

        arp.changed('updated_date', true)

        return arp.save()
          .then(() => Server.emit('monitor:arp:update', arp.get({ plain: true })))
      })
  }
}

module.exports = new Arp()
