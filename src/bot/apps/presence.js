/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function Presence() {
}

Presence.prototype.id = 'presence';

Presence.prototype.databases = [
  {type: 'sql', name: 'monitor'},
  {type: 'sql', name: 'person'},
  {type: 'sql', name: 'performance'},
  {type: 'nosql', name: 'performance'}
];

Presence.prototype.modules = [
  {type: 'monitor', name: 'arp'},
  {type: 'monitor', name: 'ip', optional: true},
  {type: 'monitor', name: 'bonjour', optional: true},
  {type: 'monitor', name: 'upnp', optional: true},
  {type: 'person', name: 'device'},
  {type: 'person', name: 'employee'},
  {type: 'person', name: 'mac_address'},
  {type: 'person', name: 'notification'},
  {type: 'performance', name: 'presence'}
];

module.exports = new Presence();