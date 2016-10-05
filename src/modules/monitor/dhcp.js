/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const DHCPRL_UNIX_SOCKET = '/var/run/dhcprl.sock'

const Promise = require('bluebird')

const Logger = require('../../utils/logger')
const Communication = require('../../utils/communication')

class DHCP extends MonitorModule {
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
      'monitor:dhcp:discover': this._discover.bind(this)
    })

    Communication.emit('worker:job:enqueue', 'monitor:dhcp:discover', null, { schedule: '1 minute' })
  }

  stop () {
    Communication.emit('worker:job:dequeue', 'monitor:dhcp:discover')

    super.stop()
  }

  _discover (params, callback) {
    return this._connectDHCPRL()
      .mapSeries((dhcp) => {
        return this._createOrUpdateDHCP(dhcp)
          .catch((error) => {
            Logger.warn(error.message + ' with dhcp as ' + JSON.stringify(dhcp), error)
          })
      })
      .then(this._clean.bind(this))
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error)
      })
  }

  _connectDHCPRL () {
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

  _clean () {
    var now = new Date()

    return this._deleteAllDHCPBeforeDate(new Date(now.setHours(now.getHours() - 24)))
      .mapSeries((dhcp) => {
        Communication.emit('monitor:dhcp:delete', dhcp)
      })
  }
}

module.exports = new DHCP()
