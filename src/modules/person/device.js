/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PersonModule = require('./person-module')

const _ = require('lodash')
const Promise = require('bluebird')

const Server = require('../../server')

const { Person, Monitor } = require('../../databases')

const Logger = require('modern-logger')

const moment = require('moment')

const discover = (macAddress, callback) => {
  return Person.devices.find({
    include: [ {
      model: Person.models[ 'mac_address' ],
      where: { id: macAddress, device_id: Person.sequelize.col('device.id') }
    } ]
  })
    .then(function (device) {
      if (device === undefined || !device.is_manual) {

        return Monitor.arp.findOne({ where: { mac_address: macAddress.address } })
          .then(function (row) {
            if (!row) {
              throw new Error('Unknown IP address for MAC address: ' + macAddress.address)
            }

            return Promise.props({
              mdns: execDig(row.ip_address),
              nmap: execNmap(row.ip_address),
              dns: execHost(row.ip_address),
              bonjours: Monitor.bonjour.findAll({ where: { ip_address: row.ip_address } }),
              upnps: Monitor.upnp.findAll({ where: { ip_address: row.ip_address } }),
              dhcps: Monitor.bonjour.findAll({ where: { mac_address: macAddress.address } })
            })
          })
          .then(function (result) {
            Logger.debug('Scan result for ' + macAddress.address + ': ' + JSON.stringify(result, null, 2))

            var _device = device || {}

            _device.manufacturer = macAddress.vendor || _device.manufacturer

            var bonjour =
              _.find(result.bonjours, { type: '_apple-mobdev2._tcp' }) ||
              _.find(result.bonjours, { type: '_afpovertcp._tcp' }) ||
              _.find(result.bonjours, { type: '_smb._tcp' }) ||
              _.find(result.bonjours, { type: '_googlecast._tcp' }) ||
              _.find(result.bonjours, { type: '_rfb._tcp' }) ||
              _.find(result.bonjours, { type: '_workstation._tcp' } ||
                _.find(result.bonjours, { type: '_dacp._tcp' })
              )

            if (result.dns.hostname && result.dns.hostname.length > 0) {
              _device.name = result.dns.hostname
            }

            if (result.dhcps && result.dhcps.length > 0 && result.dhcps[ 0 ].hostname) {
              _device.name = result.dhcps[ 0 ].hostname
            }

            if (result.mdns.hostname && result.mdns.hostname.length > 0) {
              _device.name = result.mdns.hostname
            }

            if (result.upnps && result.upnps.length > 0 && result.upnps[ 0 ].device_friendly_name) {
              _device.name = result.upnps[ 0 ].device_friendly_name
              if (_device.name.indexOf(':') !== -1) {
                _device.name = _device.name.split(':')[ 0 ]
              }
            }

            if (bonjour && bonjour.hostname && bonjour.hostname.length > 0) {
              _device.name = bonjour.hostname
            }

            if (bonjour && bonjour.name && bonjour.name.length > 0 && bonjour.name.indexOf(':') === -1) {
              _device.name = bonjour.name
            }

            if (_device.name) {
              _device.name = _device.name
                .replace(/.local/g, '')
                .replace(/-/g, ' ')
            }

            if (result.nmap.type) {
              if (!_device.type || result.nmap.type.length > _device.type.length) {
                _device.type = result.nmap.type instanceof Array ? result.nmap.type[ result.nmap.type.length - 1 ] : result.nmap.type
              }
            }

            if (result.nmap.os && result.nmap.os.length > 0) {
              _device.os = result.nmap.os
            }

            // do we fulfill the requirement to create or update existing device?
            if (_device.name) {
              _device.is_present = true
              _device.last_presence_date = new Date(macAddress.last_presence_date.replace(' ', 'T'))

              // should the device be created?
              if (!device) {
                return Person.devices.create(_device)
                  .then(function (row) {
                    macAddress.device_id = _device.id = row.id
                    macAddress.last_scan_date = new Date()
                    return Person.macAddresses.update(macAddress, { where: { address: macAddress.address } })
                      .then(function () {

                        Server.emit('person:device:discover:create', _device)

                        return _device
                      })
                  })
              } else {
                _device.is_synced = false
                return Person.devices.update(_device, { where: { id: _device.id } })
                  .then(function () {
                    return _device
                  })
              }
            }
          })
      }
    })
    .then(function (result) {
      callback(null, result)
    })
    .catch(callback)
}

const execDig = (ip) => {
  return new Promise(function (resolve, reject) {
    var result = {}

    var spawn = require('child_process').spawn,
      _process = spawn('dig', [
        '+short',
        '+time=1',
        '+tries=0',
        '+retry=0',
        '@224.0.0.251',
        '-p5353',
        '-x', ip
      ])

    _process.stdout.setEncoding('utf8')
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line !== null && line.length !== 0) {
        if (line.indexOf('.local.') !== -1) {
          result.hostname = line.split('.')[ 0 ]
        }
      }
    })

    _process.on('error', reject)
    _process.on('close', function () {
      resolve(result)
    })
  })
}

const execHost = (ip) => {
  return new Promise(function (resolve, reject) {
    var result = {}

    var spawn = require('child_process').spawn,
      _process = spawn('host', [
        ip
      ])

    _process.stdout.setEncoding('utf8')
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line !== null && line.length !== 0) {
        if (line.indexOf('domain name pointer') !== -1) {
          result.hostname = line.split(' ')[ 4 ]
          result.hostname = result.hostname.split('.')[ 0 ]
        }
      }
    })

    _process.on('error', reject)
    _process.on('close', function () {
      resolve(result)
    })
  })
}

const execNmap = (ip) => {
  return new Promise(function (resolve, reject) {

    var result = {}

    if (ip === '10.172.160.1' || ip === '10.172.161.1' || ip === '172.16.2.194' || ip === '172.16.2.5' || ip === '172.16.2.3') {
      return resolve(result)
    }

    var spawn = require('child_process').spawn,
      _process = spawn('nmap', [
        '-n',
        '--min-rate=1000',
        '-O',
        '-v',
        '--osscan-guess',
        '--max-os-tries=1',
        ip
      ])

    function parsePorts (ports, line) {
      // ie. 22/tcp open  ssh
      // $1 := port, $2 := proto, $3 := state, $4 := service
      var regex = /^([0-9]+)\/(tcp|udp)\s*(open|close|filter)\s*([\w\-]+)$/

      var state = line.replace(regex, '$3')

      if (state !== 'open' && state !== 'close' && state !== 'filter') {
        return ports
      }

      if (!ports) {
        ports = []
      }

      var port = {
        port: line.replace(regex, '$1'),
        protocol: line.replace(regex, '$2'),
        state: state,
        service: line.replace(regex, '$4')
      }

      ports.push(port)

      return ports
    }

    function parseVendor (line) {
      if (line.indexOf('MAC Address:') != 0) {
        return
      }

      // i.e. MAC Address: 68:64:4B:63:BA:33 (Apple)
      // $1 := mac address, $2 := vendor
      var regex = /^MAC Address:\s([\w:]+)\s\(([\w.\-\s]+)\)$/

      var vendor = line.replace(regex, '$2')

      return vendor === 'Unknown' ? undefined : vendor
    }

    function parseType (line) {
      if (line.indexOf('Device type:') == 0) {

        var type = line.split(': ')[ 1 ]

        if (type.indexOf('|') !== -1) {
          type = type.split('|')
        }

        return type
      }
    }

    function parseOs (line) {
      if (line.indexOf('Running:') == 0) {

        var os = line.split(': ')[ 1 ]
        os = os.replace(/(\s)?[\w]+\.[\w]+(\.[\w]+)?/g, '').replace(/\|/g, '')

        if (os.indexOf(', ') !== -1) {
          os = os.split(', ')
        }

        return os
      }
    }

    function parseOsDetails (line) {
      if (line.indexOf('OS details:') !== 0) {
        return
      }

      var _line = line.substring('OS details:'.length)

      // i.e. OS details: Apple Mac OS X 10.7.0 (Lion) - 10.10 (Yosemite) or iOS 4.1 - 8.3 (Darwin 10.0.0 - 14.5.0)
      // i.e. OS details: Linux 3.2 - 4.0
      // $1 := OS name, $2 := OS version
      var regex = /^([a-zA-Z\s]+)\s(\d[\d\w.\s\-\(\)]+)$/

      var name = _line.replace(regex, '$1')
      var version = _line.replace(regex, '$2')

      return { name: name, version: version }
    }

    function parseOsGuess (line) {
      if (line.indexOf('Aggressive OS guesses:') !== 0) {
        return
      }

      var _line = line.substring('Aggressive OS guesses:'.length)

      // i.e. Aggressive OS guesses: Apple iOS 5.0.1 (95%), Apple iOS 5.0.1 - 5.1.1 (95%),
      // Apple iOS 6.1.4 (Darwin 13.0.0) (95%),
      // Apple Mac OS X 10.10.3 (Yosemite) - 10.11.0 (El Capitan) (Darwin 14.3.0 - 15.0.0) (%95),
      // Apple Mac OS X 10.7.0 (Lion) - 10.11 (El Capitan) or iOS 4.1 - 9 (Darwin 10.0.0 - 15.0.0) (95%)
      var guesses = _line.split(', ')

      // $1 := OS name, $2 := OS version, $3 := confidence percentage
      var regex = /^([a-zA-Z\s]+)\s(.*)\s([\(\d\)\%]+)$/

      return _.map(guesses, function (guess) {
        var name = guess.replace(regex, '$1')
        var version = guess.replace(regex, '$2')
        var confidence = guess.replace(regex, '$3')

        return { name: name, version: version, confidence: confidence }
      })
    }

    _process.stdout.setEncoding('utf8')
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line && line.length > 0) {

        result.ports = parsePorts(result.ports, line) // multi-line
        result.vendor = result.vendor || parseVendor(line)
        result.type = result.type || parseType(line)
        result.os = result.os || parseOs(line)
        result.os_details = result.os_details || parseOsDetails(line)
        result.os_guess = result.os_guess || parseOsGuess(line)
      }
    })

    _process.on('error', reject)
    _process.on('close', function () {
      resolve(result)
    })
  })
}

const isPresent = (device) => {
  return new Promise(function (resolve, reject) {

    function handleArpDiscover () {
      Server.removeListener('monitor:arp:discover:finish', handleArpDiscover)

      return Person.macAddresses.findAll({ where: { device_id: device.id } })
        .then(function (mac_addresses) {
          if (mac_addresses !== undefined) {
            var values = _.map(mac_addresses, 'address')

            return Server.emitAsync('database:monitor:retrieveAll',
              'SELECT * FROM arp WHERE mac_address IN (' + values.map(function () {
                return '?'
              }) + ')',
              values)
              .then(function (rows) {
                resolve(rows !== undefined && rows !== null && rows.length > 0)
              })
          }
        })
        .catch(function (error) {
          reject(error)
        })
    }

    Server.on('monitor:arp:discover:finish', handleArpDiscover)
  })
}

const onMacAddressOnline = (mac_address) => {
  if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
    return Person.devices.findById(mac_address.device_id)
      .then((device) => {
        if (device && !device.is_present) {
          device.is_present = true
          device.last_presence_date = mac_address.last_presence_date
          device.is_synced = false

          return device.save()
            .then(function () {
              Server.emit('person:device:online', device.get({ plain: true }))
            })
        }
      })
      .catch((error) => {
        Logger.error(error)
      })
  }
}

const onMacAddressOnlineAgain = (mac_address) => {
  if (mac_address.device_id && mac_address.device_id !== null) {
    Person.devices.findById(mac_address.device_id)
      .then((device) => {
        if (device) {
          device.last_presence_date = mac_address.last_presence_date
          device.is_synced = false

          device.save()
            .then(() => Server.emit('person:device:onlineAgain', device.get({ plain: true })))
        }
      })
  }

  if (!mac_address.last_scan_date || moment(mac_address.last_scan_date).isBefore(moment().subtract(1, 'hour'))) {

    mac_address.last_scan_date = new Date()
    return Person.macAddresses.update(mac_address, { where: { address: mac_address.address } })
      .then(() => Server.enqueueJob('person:device:discover', mac_address))
  }
}

const onMacAddressOffline = (macAddress) => {
  if (macAddress.device_id) {
    return Person.macAddresses.findAll({ where: { device_id: macAddress.device_id } })
      .then((macAddresses) => {
        if (macAddresses) {
          const _macAddresses = _.filter(macAddresses, _.matches({ is_present: true }))

          if (_.isEmpty(_macAddresses)) {
            return Person.devices.findById(macAddress.device_id)
              .then((device) => {
                if (device) {
                  device.is_present = false
                  device.last_presence_date = macAddress.last_presence_date
                  device.is_synced = false

                  return device.save()
                    .then(() => Server.emit('person:device:offline', device.get({ plain: true })))
                }
              })
          }
        }
      })
      .catch((error) => Logger.error(error))
  }
}

class Device extends PersonModule {
  constructor () {
    super('device')
  }

  start () {
    super.start({
      'person:mac_address:online': onMacAddressOnline,
      'person:mac_address:onlineAgain': onMacAddressOnlineAgain,
      'person:mac_address:offline': onMacAddressOffline,
      'person:device:is_present': isPresent,
      'person:device:discover': discover
    })
  }

  stop () {
    Server.removeAllListeners('monitor:arp:discover:finish')

    Server.dequeueJob('person:device:discover')

    super.stop()
  }
}

module.exports = new Device()
