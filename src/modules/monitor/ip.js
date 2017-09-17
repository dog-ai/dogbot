/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const _ = require('lodash')
const Promise = require('bluebird')

const Server = require('../../server')

const { Monitor } = require('../../databases')

const { retry } = require('../../utils')

const os = require('os')

const onServiceDiscoveryCreateOrUpdate = function (service, callback) {
  return Monitor.ip.findOne({
    where: {
      ip_address: service.ip_address,
      updated_date: { $gte: new Date(new Date().setSeconds(new Date().getSeconds() - 10)) }
    }
  })
    .then((ip) => {
      if (!ip) {
        const _ip = { ip_address: service.ip_address }

        return Monitor.ip.create(_ip)
          .then(() => Server.emit('monitor:ip:create', _ip))
      }

      return ip.save()
        .then(() => Server.emit('monitor:ip:update', ip.get({ plain: true })))
    })
    .then(() => callback())
    .catch((error) => callback(error))
}

const execFping = function () {
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

class Ip extends MonitorModule {
  constructor () {
    super('ip')
  }

  start () {
    super.start({
      'monitor:ip:discover': this.discover.bind(this),
      'monitor:bonjour:create': onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:bonjour:update': onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:upnp:create': onServiceDiscoveryCreateOrUpdate.bind(this),
      'monitor:upnp:update': onServiceDiscoveryCreateOrUpdate.bind(this)
    })

    Server.enqueueJob('monitor:ip:discover', null, { schedule: '1 minute', priority: 'low' })
  }

  stop () {
    Server.dequeueJob('monitor:ip:discover')

    super.stop()
  }

  discover (params, callback) {
    return super.discover(() => retry(() => execFping(), {
      timeout: 50000,
      max_tries: -1,
      interval: 1000,
      backoff: 2
    }), [ 'ip_address' ], new Date(new Date().setMinutes(new Date().getMinutes() - 10)))
      .then(() => callback())
      .catch((error) => callback(error))
  }
}

module.exports = new Ip()

