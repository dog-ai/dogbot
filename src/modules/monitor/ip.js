/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const _ = require('lodash')
const Promise = require('bluebird')
const retry = require('bluebird-retry')

const Communication = require('../../utils/communication')

const os = require('os')

class IP extends MonitorModule {
  constructor () {
    super('ip')
  }

  start () {
    super.start({
      'monitor:ip:discover': this._discover.bind(this),
      'monitor:bonjour:create': this._onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:bonjour:update': this._onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:upnp:create': this._onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:upnp:update': this._onServiceDiscoveryCreateOrUpdate.bind(this)
    })

    Communication.emit('worker:job:enqueue', 'monitor:ip:discover', null, {
      schedule: '1 minute',
      priority: 'low'
    })
  }

  stop () {
    Communication.emit('worker:job:dequeue', 'monitor:ip:discover')

    super.stop()
  }

  _discover (params, callback) {
    return retry(() => this._execFping(), { max_tries: 3, interval: 1000 })
      .then((ips) => {
        return Promise.mapSeries(ips, (ip) => {
          return this._createOrUpdateIP(ip)
        })
          .then(() => {
            return this._clean()
          })
      })
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error)
      })
  }

  _onServiceDiscoveryCreateOrUpdate (service, callback) {
    var date = new Date(new Date().setSeconds(new Date().getSeconds() - 10))
    var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '')

    return Communication.emitAsync('database:monitor:retrieveOne',
      'SELECT * FROM ip WHERE ip_address = ? AND updated_date > Datetime(?)', [ service.ip_address, updatedDate ])
      .then((row) => {
        if (row === undefined) {
          var ip = {
            ip_address: service.ip_address
          }

          return this._createOrUpdateIP(ip)
        }
      })
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error)
      })
  }

  _execFping () {
    return new Promise((resolve, reject) => {
      var ips = []

      var networkInterfaces = os.networkInterfaces()
      var addresses = networkInterfaces[ 'wlan0' ] || networkInterfaces[ 'en0' ]

      if (addresses === undefined || addresses === null) {
        reject(new Error('Network issues'))
      }

      var address = _.find(addresses, { family: 'IPv4', internal: false })

      if (address === undefined) {
        reject(new Error('Network issues'))
      }

      var subnet = require('ip').subnet(address.address, address.netmask)

      var process = require('child_process')
        .spawn('fping', [
          '-a', // Show targets that are alive
          '-r 1', // Number of retries (default 3)
          '-i 10', // Interval between sending ping packets (in millisec) (default 25)
          '-t 500', // Individual target initial timeout (in millisec) (default 500)
          '-q',
          '-g', subnet.networkAddress + '/' + subnet.subnetMaskLength
        ])

      process.stdout.setEncoding('utf8')

      process.stdout.pipe(require('split')()).on('data', (line) => {
        if (!/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(line)) {
          return
        }

        if (line.indexOf(address.address) === 0) {
          return
        }

        var ip = {
          ip_address: line
        }

        ips.push(ip)
      })

      process.stderr.pipe(require('split')()).on('data', (line) => {
        if (line === undefined ||
          line.length === 0 ||
          line.indexOf('ICMP Host') !== -1 ||
          line.indexOf('duplicate') !== -1 ||
          line.indexOf('ICMP Redirect') !== -1 ||
          line.indexOf('ICMP Time Exceeded ') !== -1) {
          return
        }

        reject(new Error(line))
      })

      process.on('error', (error) => {
        reject(error)
      })

      process.on('close', () => {
        resolve(ips)
      })
    })
  }

  _clean () {
    var now = new Date()
    return this._deleteAllIPBeforeDate(new Date(now.setMinutes(now.getMinutes() - 10)),
      (ip) => {
        Communication.emit('monitor:ipAddress:delete', ip.ip_address)
      })
  }
}

module.exports = new IP()

