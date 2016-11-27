/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const MonitorModule = require('./monitor-module')

const Promise = require('bluebird')
const retry = require('bluebird-retry')

const { Logger } = require('../../utils')
const Communication = require('../../utils/communication')

class Bonjour extends MonitorModule {
  constructor () {
    super('bonjour')
  }

  load () {
    if (process.platform !== 'linux') {
      throw new Error(process.platform + ' platform is not supported')
    }

    super.load()
  }

  start () {
    super.start({
      'monitor:bonjour:discover': this._discover.bind(this)
    })

    Communication.emit('worker:job:enqueue', 'monitor:bonjour:discover', null, { schedule: '1 minute' })
  }

  stop () {
    Communication.emit('worker:job:dequeue', 'monitor:bonjour:discover')

    super.stop()
  }

  _discover (params, callback) {
    return retry(() => this._execAvahiBrowse(), { max_tries: 3, interval: 1000 })
      .then((bonjours) => {
        return Promise.mapSeries(bonjours, (bonjour) => {
          return this._createOrUpdateBonjour(bonjour)
            .catch((error) => Logger.warn(error))
        })
          .then(() => this._clean())
      })
      .then(() => {
        callback()
      })
      .catch(callback)
  }

  _execAvahiBrowse () {
    return new Promise((resolve, reject) => {
      var bonjours = []

      var timeout
      var spawn = require('child_process').spawn
      var process = spawn('avahi-browse', [ '-alrpt' ])

      timeout = setTimeout(() => {
        process.stdin.pause()
        process.stderr.pause()
        process.kill()
        resolve(bonjours)
      }, 15000) // wait 15 seconds for process to finish

      process.stdout.setEncoding('utf8')
      process.stdout.pipe(require('split')()).on('data', (line) => {
        if (line.charAt(0) !== '=') {
          return
        }

        var values = line.split(';')

        var bonjour = {
          name: values[ 3 ],
          type: values[ 4 ],
          hostname: values[ 6 ],
          ip_address: values[ 7 ],
          port: values[ 8 ],
          txt: values[ 9 ]
        }

        if (bonjour.name && bonjour.name.length > 0 &&
          bonjour.type && bonjour.type.length > 0 &&
          bonjour.hostname && bonjour.hostname.length > 0 &&
          /^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(bonjour.ip_address) &&
          bonjour.ip_address && bonjour.ip_address.length > 0 && bonjour.ip_address.indexOf('169.') !== 0 &&
          bonjour.port && bonjour.port.length > 0 &&
          bonjour.txt && bonjour.txt.length > 0) {
          // TODO: remove this after doing proper escaping of sql fields
          bonjour.name = bonjour.name.replace(/'/gi, '’')

          // {"name":"Figure (Ferruccio's iPhone)","type":"_audiobus._udp","hostname":"Ferruccios-iPhone.local","ip_address":"172.16.2.168","port":"55059","txt":"\"displayName=Figure\" \"allowsMultiplethiss=0\" \"triggersExtraInfo[0]=\" \"launchURL=phfigure.1.6.2.audiobus://\" \"launchPeersOverAudiobus=1\" \"DBVersion=3\" \"remoteTriggers[1]=+\" \"appIconResourceID=2706529516\" \"triggers[0]=\" \"inForeground=0\" \"capabilities=1\" \"remoteTriggers[0]=+\" \"outputs[0]=\u000b\" \"version=3\" \"sequence=13\" \"deviceID=BA5259F8-5DC4-4152-A057-2F6B5E44D2A9\" \"SDK version=2.2.1\"","updated_date":"2016-04-12T09:27:01.328Z"}
          // TODO: need to do this in the avahi-browse itself
          bonjour.txt = bonjour.txt.replace(/[^0-9a-z_:\/\s=\[\]+-\\"\(\)'']/gi, '')

          bonjours.push(bonjour)
        }
      })

      process.stderr.pipe(require('split')()).on('data', (line) => {
        if (line === undefined ||
          line.length === 0 ||
          line.indexOf('Failed to resolve service') === 0) {
          return
        }

        clearTimeout(timeout)
        reject(new Error(line))
      })

      process.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      process.on('close', () => {
        clearTimeout(timeout)
        resolve(bonjours)
      })
    })
  }

  _clean () {
    var now = new Date()

    return this._deleteAllBonjourBeforeDate(new Date(now.setHours(now.getHours() - 24)))
      .mapSeries((bonjour) => {
        Communication.emit('monitor:bonjour:delete', bonjour.ip_address)
      })
  }
}

module.exports = new Bonjour()

