/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const MINISSDPD_UNIX_SOCKET = process.env.MINISSDPD_UNIX_SOCKET || '/var/run/minissdpd.sock'

const _ = require('lodash')
const Promise = require('bluebird')

const Server = require('../../server')

const { retry } = require('../../utils')

const readUPnPDescription = function (url) {
  return new Promise(function (resolve, reject) {
    var req = require('http').get(url, function (res) {
      var xml = ''

      res.on('data', function (data) {
        xml += data
      })

      res.on('error', function (data) {
        reject(new Error(data))
      })

      res.on('timeout', function (data) {
        reject(new Error(data))
      })

      res.on('end', function () {
        require('xml2js').parseString(xml, function (error, json) {
          resolve(json)
        })
      })
    }).on('error', function (error) {
      reject(error)
    })

    req.setTimeout(6000, function () {
      reject(new Error('Timeout while reading UPnP device description file from ' + url))
    })
  })
}

const execMiniSSDPd = function () {
  return new Promise(function (resolve, reject) {
    var timeout, ssdps = []

    var socket = require('net').createConnection(MINISSDPD_UNIX_SOCKET)

    socket.on('connect', function () {
      var buffer = new Buffer([ 0x03, 0x00, 0x00 ])
      socket.write(buffer)

      timeout = setTimeout(function () {
        socket.destroy()
      }, 100)
    })

    socket.on('data', function (data) {
      clearTimeout(timeout)

      var strings = []
      for (var pos = 1; pos < data.length; pos = end) {
        var start = pos + 1
        var length = data[ pos ]
        var end = start + length

        strings.push(data.toString('utf8', start, end))
      }

      ssdps = ssdps.concat((_.chain(strings).chunk(3).map(function (strings) {
        return {
          location: strings[ 0 ],
          type: strings[ 1 ],
          usn: strings[ 2 ]
        }
      }).value()))

      socket.destroy()
    })

    socket.on('error', function (data) {
      reject(new Error(data))
    })
    socket.on('timeout', function (data) {
      reject(new Error(data))
    })

    socket.on('close', function () {
      return Promise.try(() => {
        return _.chain(ssdps)
          .map('location')
          .uniq()
          .map((location) => require('url').parse(location))
          .uniq((url) => url.hostname)
          .value()
      })
        .mapSeries((url) => {
          return readUPnPDescription(url)
            .then((description) => {
              return {
                location: url.href,
                ip_address: url.hostname,
                device_friendly_name: description.root.device[ 0 ].friendlyName[ 0 ],
                device_manufacturer: description.root.device[ 0 ].manufacturer !== undefined ? description.root.device[ 0 ].manufacturer[ 0 ] : undefined,
                device_model_name: description.root.device[ 0 ].modelName !== undefined ? description.root.device[ 0 ].modelName[ 0 ] : undefined,
                device_model_description: description.root.device[ 0 ].modelDescription !== undefined ? description.root.device[ 0 ].modelDescription[ 0 ] : undefined
              }
            })
        })
        .then((upnps) => resolve(upnps))
        .catch((error) => reject(error))
    })
  })
}

class Upnp extends MonitorModule {
  constructor () {
    super('upnp')
  }

  load () {
    if (!require('fs').existsSync(MINISSDPD_UNIX_SOCKET)) {
      throw new Error('minissdpd unix socket not available')
    }

    super.load()
  }

  start () {
    super.start({
      'monitor:upnp:discover': this.discover.bind(this)
    })

    Server.enqueueJob('monitor:upnp:discover', null, { schedule: '1 minute' })
  }

  stop () {
    Server.dequeueJob('monitor:upnp:discover')

    super.stop()
  }

  discover (params, callback) {
    return retry(() => execMiniSSDPd(), { timeout: 50000, max_tries: -1, interval: 1000, backoff: 2 })
      .then((upnps) => super.discover(upnps, [ 'ip_address' ], new Date(new Date().setMinutes(new Date().getHours() - 24))))
      .then(() => callback())
      .catch((error) => callback(error))
  }
}

module.exports = new Upnp()
