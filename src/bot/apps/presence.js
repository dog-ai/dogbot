/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const App = require('./app')

class Presence extends App {
  constructor () {
    super('presence',
      [
        { type: 'sql', name: 'monitor' },
        { type: 'sql', name: 'person' },
        { type: 'sql', name: 'performance' },
        { type: 'nosql', name: 'performance' }
      ],
      [
        { type: 'monitor', name: 'arp' },
        { type: 'monitor', name: 'ip', optional: true },
        { type: 'monitor', name: 'bonjour', optional: true },
        { type: 'monitor', name: 'upnp', optional: true },
        { type: 'monitor', name: 'dhcp', optional: true },
        { type: 'person', name: 'device' },
        { type: 'person', name: 'employee' },
        { type: 'person', name: 'mac_address' },
        { type: 'person', name: 'notification' },
        { type: 'performance', name: 'presence' }
      ])
  }
}

module.exports = new Presence()
