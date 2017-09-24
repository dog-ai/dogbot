/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')
const retry = require('bluebird-retry')

const spawn = require('child_process').spawn

const split = require('split')

class ArpScan {
  run () {
    return retry(() => {
      return new Promise((resolve, reject) => {
        const result = []

        const networkInterface = process.platform === 'linux' ? 'wlan0' : 'en0'

        const childProcess = spawn('arp-scan', [
          `--interface=${networkInterface}`,
          '--localnet',
          '--numeric', // IP addresses only, no hostnames.
          '--quiet',
          '--ignoredups', // Don't display duplicate packets.
          '--timeout=1000', // Set initial per host timeout to ms.
          '--retry=4',
          '--plain' // Display plain output showing only responding hosts.
        ])

        const onData = (line) => {
          const values = line.split('\t')

          const arp = { ip_address: values[ 0 ], mac_address: values[ 1 ] }

          if (arp.ip_address && arp.mac_address) {
            result.push(arp)
          }
        }

        childProcess.stdout.setEncoding('utf8')
        childProcess.stdout.pipe(split()).on('data', onData)
        childProcess.stderr.on('data', (data) => reject(new Error(data)))
        childProcess.on('error', reject)
        childProcess.on('close', () => resolve(result))
      })
    }, { timeout: 50000, max_tries: -1, interval: 1000, backoff: 2 })
  }
}

module.exports = new ArpScan()
