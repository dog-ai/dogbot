/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const DHCPRL_UNIX_SOCKET = process.env.DHCPRL_UNIX_SOCKET || '/var/run/dhcprl.sock'

const Promise = require('bluebird')

const Server = require('../../server')

const { retry } = require('../../utils')

const connect = function () {
  return new Promise((resolve, reject) => {
    var timeout
    var dhcps = []

    var socket = require('net').createConnection(DHCPRL_UNIX_SOCKET)

    socket.on('connect', () => {
      var buffer = new Buffer([ 0x00 ])
      socket.write(buffer)

      timeout = setTimeout(() => {
        socket.destroy()
      }, 100)
    })

    socket.pipe(require('split')()).on('data', (line) => {
      clearTimeout(timeout)

      if (line && line.length > 0) {
        var values = line.split(';')

        var dhcp = {
          mac_address: values[ 1 ],
          hostname: values[ 2 ]
        }

        dhcps.push(dhcp)
      }

      socket.destroy()
    })

    socket.on('error', (data) => {
      reject(new Error(data))
    })
    socket.on('timeout', (data) => {
      reject(new Error(data))
    })

    socket.on('close', () => {
      resolve(dhcps)
    })
  })
}

class Dhcp extends MonitorModule {
  constructor () {
    super('dhcp')
  }

  load () {
    if (!require('fs').existsSync(DHCPRL_UNIX_SOCKET)) {
      throw new Error('dhcprl unix socket not available')
    }

    super.load()
  }

  start () {
    super.start({
      'monitor:dhcp:discover': this.discover.bind(this)
    })

    Server.enqueueJob('monitor:dhcp:discover', null, { schedule: '1 minute' })
  }

  stop () {
    Server.dequeueJob('monitor:dhcp:discover')

    super.stop()
  }

  discover (params, callback) {
    return super.discover(() => retry(() => connect(), {
      timeout: 50000,
      max_tries: -1,
      interval: 1000,
      backoff: 2
    }), [ 'mac_address', 'hostname' ], new Date(new Date().setMinutes(new Date().getHours() - 24)))
      .then(() => callback())
      .catch((error) => callback(error))
  }
}

module.exports = new Dhcp()
