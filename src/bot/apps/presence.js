/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function presence() {
}

presence.prototype.name = 'presence';

presence.prototype.databases = [
  {type: 'sql', name: 'monitor'},
  {type: 'sql', name: 'person'},
  {type: 'sql', name: 'performance'},
  {type: 'nosql', name: 'performance'}
];

presence.prototype.modules = [
  {type: 'monitor', name: 'arp'},
  {type: 'monitor', name: 'ip', optional: true},
  {type: 'monitor', name: 'bonjour', optional: true},
  {type: 'monitor', name: 'upnp', optional: true},
  {type: 'person', name: 'device'},
  {type: 'person', name: 'employee'},
  {type: 'person', name: 'employee/profile/linkedin'},
  {type: 'person', name: 'mac_address'},
  {type: 'person', name: 'notification'},
  {type: 'performance', name: 'presence'}
];

module.exports = new presence();