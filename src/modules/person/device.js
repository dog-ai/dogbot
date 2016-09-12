/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  _ = require('lodash'),
  moment = require('moment'),
  Promise = require('bluebird');

function device() {
}

device.prototype.type = "PERSON";

device.prototype.name = "device";

device.prototype.info = function () {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

device.prototype.load = function (communication) {
  this.communication = communication;

  this.start();
};

device.prototype.unload = function () {
  this.stop();
};

device.prototype.start = function () {
  this.communication.on('person:mac_address:online', this._onMacAddressOnline);
  this.communication.on('person:mac_address:onlineAgain', this._onMacAddressOnlineAgain);
  this.communication.on('person:mac_address:offline', this._onMacAddressOffline);
  this.communication.on('person:device:is_present', this._isPresent);
  this.communication.on('person:device:discover', this._discover);
  this.communication.on('sync:incoming:person:device:create', this._onCreateOrUpdateDeviceIncomingSynchronization);
  this.communication.on('sync:incoming:person:device:update', this._onCreateOrUpdateDeviceIncomingSynchronization);
  this.communication.on('sync:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
  this.communication.on('sync:outgoing:person:device', this._onDeviceOutgoingSynchronization);

  this.communication.emitAsync('sync:incoming:register:setup', {
    companyResource: 'devices',
    onCompanyResourceAddedCallback: function (device) {
      instance.communication.emit('sync:incoming:person:device:create', device);
    },
    onCompanyResourceChangedCallback: function (device) {
      instance.communication.emit('sync:incoming:person:device:update', device);
    },
    onCompanyResourceRemovedCallback: function (device) {
      instance.communication.emit('sync:incoming:person:device:delete', device);
    }
  });

  this.communication.emitAsync('sync:outgoing:periodic:register', {
    companyResource: 'devices',
    event: 'sync:outgoing:person:device'
  });

  this.communication.emit('sync:outgoing:quickshot:register', {
    companyResource: 'devices',
    registerEvents: ['person:device:online', 'person:device:offline', 'person:device:discover:create'],
    outgoingEvent: 'sync:outgoing:person:device'
  });
};

device.prototype.stop = function () {
  this.communication.removeListener('person:mac_address:online', this._onMacAddressOnline);
  this.communication.removeListener('person:mac_address:onlineAgain', this._onMacAddressOnlineAgain);
  this.communication.removeListener('person:mac_address:offline', this._onMacAddressOffline);
  this.communication.removeListener('sync:incoming:person:device:create', this._onCreateOrUpdateDeviceIncomingSynchronization);
  this.communication.removeListener('sync:incoming:person:device:update', this._onCreateOrUpdateDeviceIncomingSynchronization);
  this.communication.removeListener('sync:incoming:person:device:delete', this._onDeleteDeviceIncomingSynchronization);
  this.communication.removeListener('person:device:is_present', this._isPresent);
  this.communication.removeListener('person:device:discover', this._discover);
  this.communication.removeListener('sync:outgoing:person:device', this._onDeviceOutgoingSynchronization);

  this.communication.removeAllListeners('monitor:arp:discover:finish');

  this.communication.emit('worker:job:dequeue', 'person:device:discover');
};

device.prototype._discover = function (macAddress, callback) {
  return instance._findByMacAddress(macAddress.address)
    .then(function (device) {
      if (device === undefined || !device.is_manual) {

        return instance._findIpAdressByMacAddress(macAddress.address)
          .then(function (row) {
            if (row === undefined || row === null) {
              throw new Error('Unknown IP address for MAC address: ' + macAddress.address);
            }

            return Promise.props({
              mdns: instance._execDig(row.ip_address),
              nmap: instance._execNmap(row.ip_address),
              dns: instance._execHost(row.ip_address),
              bonjours: instance._findAllBonjoursByIpAddress(row.ip_address),
              upnps: instance._findAllUPnPsByIpAddress(row.ip_address),
              dhcps: instance._findAllDHCPsByMACAddress(macAddress.address)
            });
          })
          .then(function (result) {
            logger.debug('Scan result for ' + macAddress.address + ': ' + JSON.stringify(result, null, 2));

            var _device = device || {};

            _device.manufacturer = macAddress.vendor || _device.manufacturer;

            var bonjour =
              _.find(result.bonjours, {type: '_apple-mobdev2._tcp'}) ||
              _.find(result.bonjours, {type: '_afpovertcp._tcp'}) ||
              _.find(result.bonjours, {type: '_smb._tcp'}) ||
              _.find(result.bonjours, {type: '_googlecast._tcp'}) ||
              _.find(result.bonjours, {type: '_rfb._tcp'}) ||
              _.find(result.bonjours, {type: '_workstation._tcp'} ||
                _.find(result.bonjours, {type: '_dacp._tcp'})
              );

            if (result.dns.hostname && result.dns.hostname.length > 0) {
              _device.name = result.dns.hostname;
            }
            
            if (result.dhcps && result.dhcps.length > 0 && result.dhcps[0].hostname) {
              _device.name = result.dhcps[0].hostname;
            }

            if (result.mdns.hostname && result.mdns.hostname.length > 0) {
              _device.name = result.mdns.hostname;
            }

            if (result.upnps && result.upnps.length > 0 && result.upnps[0].device_friendly_name) {
              _device.name = result.upnps[0].device_friendly_name;
              if (_device.name.indexOf(':') != -1) {
                _device.name = _device.name.split(':')[0];
              }
            }

            if (bonjour && bonjour.hostname && bonjour.hostname.length > 0) {
              _device.name = bonjour.hostname;
            }

            if (bonjour && bonjour.name && bonjour.name.length > 0 && bonjour.name.indexOf(':') == -1) {
              _device.name = bonjour.name;
            }

            if (_device.name) {
              _device.name = _device.name
                .replace(/.local/g, '')
                .replace(/-/g, ' ');
            }

            if (result.nmap.type) {
              if (!_device.type || result.nmap.type.length > _device.type.length) {
                _device.type = result.nmap.type instanceof Array ? result.nmap.type[result.nmap.type.length - 1] : result.nmap.type;
              }
            }

            if (result.nmap.os && result.nmap.os.length > 0) {
              _device.os = result.nmap.os;
            }

            // do we fulfill the requirement to create or update existing device?
            if (_device.name) {
              _device.is_present = true;
              _device.last_presence_date = new Date(macAddress.last_presence_date.replace(' ', 'T'));

              // should the device be created?
              if (!device) {
                return instance._add(_device)
                  .then(function (row) {
                    macAddress.device_id = _device.id = row.id;
                    macAddress.updated_date = new Date();
                    macAddress.last_scan_date = new Date();
                    return instance._updateMacAddressByAddress(macAddress.address, macAddress)
                      .then(function () {

                        instance.communication.emit('person:device:discover:create', _device);

                        return _device;
                      });
                  })
              } else {
                _device.updated_date = new Date();
                _device.is_synced = false;
                return instance._updateById(_device.id, _device)
                  .then(function () {
                    return _device;
                  });
              }
            }
          })
      }
    })
    .then(function (result) {
      callback(null, result);
    })
    .catch(callback);
};

device.prototype._generatePushID = (function () {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

  // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
  var lastPushTime = 0;

  // We generate 72-bits of randomness which get turned into 12 characters and appended to the
  // timestamp to prevent collisions with other clients.  We store the last characters we
  // generated because in the event of a collision, we'll use those same characters except
  // "incremented" by one.
  var lastRandChars = [];

  return function () {
    var now = new Date().getTime();
    var duplicateTime = (now === lastPushTime);
    lastPushTime = now;

    var timeStampChars = new Array(8);
    for (var i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64);
    }
    if (now !== 0) throw new Error('We should have converted the entire timestamp.');

    var id = timeStampChars.join('');

    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[i] = Math.floor(Math.random() * 64);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
        lastRandChars[i] = 0;
      }
      lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if (id.length != 20) throw new Error('Length should be 20.');

    return id;
  };
})();

device.prototype._execDig = function (ip) {
  return new Promise(function (resolve, reject) {
    var result = {};

    var spawn = require('child_process').spawn,
      _process = spawn('dig', [
        '+short',
        '+time=1',
        '+tries=0',
        '+retry=0',
        '@224.0.0.251',
        '-p5353',
        '-x', ip
      ]);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line !== null && line.length !== 0) {
        if (line.indexOf('.local.') !== -1) {
          result.hostname = line.split('.')[0];
        }
      }
    });

    _process.on('error', reject);
    _process.on('close', function () {
      resolve(result);
    });
  })
};

device.prototype._execHost = function (ip) {
  return new Promise(function (resolve, reject) {
    var result = {};

    var spawn = require('child_process').spawn,
      _process = spawn('host', [
        ip
      ]);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line !== null && line.length !== 0) {
        if (line.indexOf('domain name pointer') !== -1) {
          result.hostname = line.split(' ')[4];
          result.hostname = result.hostname.split('.')[0];
        }
      }
    });

    _process.on('error', reject);
    _process.on('close', function () {
      resolve(result);
    });
  })
};

device.prototype._execNmap = function (ip) {
  return new Promise(function (resolve, reject) {

    var result = {};

    if (ip === '10.172.160.1' || ip === '10.172.161.1' || ip === '172.16.2.194' || ip === '172.16.2.5' || ip === '172.16.2.3') {
      return resolve(result);
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
      ]);

    function parsePorts (ports, line) {
      // ie. 22/tcp open  ssh
      // $1 := port, $2 := proto, $3 := state, $4 := service
      var regex = /^([0-9]+)\/(tcp|udp)\s*(open|close|filter)\s*([\w\-]+)$/;

      var state = line.replace(regex, '$3');

      if (state !== 'open' && state !== 'close' && state !== 'filter') {
        return ports;
      }

      if (!ports) {
        ports = [];
      }

      var port = {
        port: line.replace(regex, '$1'),
        protocol: line.replace(regex, '$2'),
        state: state,
        service: line.replace(regex, '$4')
      }

      ports.push(port);

      return ports;
    }

    function parseVendor (line) {
      if (line.indexOf('MAC Address:') != 0) {
        return;
      }

      // i.e. MAC Address: 68:64:4B:63:BA:33 (Apple)
      // $1 := mac address, $2 := vendor
      var regex = /^MAC Address:\s([\w:]+)\s\(([\w.\-\s]+)\)$/;

      var vendor = line.replace(regex, '$2');

      return vendor === 'Unknown' ? undefined : vendor;
    }

    function parseType (line) {
      if (line.indexOf('Device type:') == 0) {

        var type = line.split(': ')[1];

        if (type.indexOf('|') !== -1) {
          type = type.split('|');
        }

        return type;
      }
    }

    function parseOs (line) {
      if (line.indexOf('Running:') == 0) {

        var os = line.split(': ')[1];
        os = os.replace(/(\s)?[\w]+\.[\w]+(\.[\w]+)?/g, '').replace(/\|/g, '');

        if (os.indexOf(', ') !== -1) {
          os = os.split(', ');
        }

        return os;
      }
    }

    function parseOsDetails (line) {
      if (line.indexOf('OS details:') !== 0) {
        return;
      }

      var _line = line.substring('OS details:'.length);

      // i.e. OS details: Apple Mac OS X 10.7.0 (Lion) - 10.10 (Yosemite) or iOS 4.1 - 8.3 (Darwin 10.0.0 - 14.5.0)
      // i.e. OS details: Linux 3.2 - 4.0
      // $1 := OS name, $2 := OS version
      var regex = /^([a-zA-Z\s]+)\s(\d[\d\w.\s\-\(\)]+)$/;

      var name = _line.replace(regex, '$1');
      var version = _line.replace(regex, '$2');

      return {name: name, version: version};
    }

    function parseOsGuess (line) {
      if (line.indexOf('Aggressive OS guesses:') !== 0) {
        return;
      }

      var _line = line.substring('Aggressive OS guesses:'.length);

      // i.e. Aggressive OS guesses: Apple iOS 5.0.1 (95%), Apple iOS 5.0.1 - 5.1.1 (95%),
      // Apple iOS 6.1.4 (Darwin 13.0.0) (95%),
      // Apple Mac OS X 10.10.3 (Yosemite) - 10.11.0 (El Capitan) (Darwin 14.3.0 - 15.0.0) (%95),
      // Apple Mac OS X 10.7.0 (Lion) - 10.11 (El Capitan) or iOS 4.1 - 9 (Darwin 10.0.0 - 15.0.0) (95%)
      var guesses = _line.split(', ');

      // $1 := OS name, $2 := OS version, $3 := confidence percentage
      var regex = /^([a-zA-Z\s]+)\s(.*)\s([\(\d\)\%]+)$/;

      return _.map(guesses, function (guess) {
        var name = guess.replace(regex, '$1');
        var version = guess.replace(regex, '$2');
        var confidence = guess.replace(regex, '$3');

        return {name: name, version: version, confidence: confidence};
      });
    }

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line && line.length > 0) {

        result.ports = parsePorts(result.ports, line); // multi-line
        result.vendor = result.vendor || parseVendor(line);
        result.type = result.type || parseType(line);
        result.os = result.os || parseOs(line);
        result.os_details = result.os_details || parseOsDetails(line);
        result.os_guess = result.os_guess || parseOsGuess(line);
      }
    });

    _process.on('error', reject);
    _process.on('close', function () {
      resolve(result);
    });
  })
};

device.prototype._isPresent = function (device) {
  return new Promise(function (resolve, reject) {

    function handleArpDiscover() {
      instance.communication.removeListener('monitor:arp:discover:finish', handleArpDiscover);

      return instance._findMacAddressesByDeviceId(device.id)
        .then(function (mac_addresses) {
          if (mac_addresses !== undefined) {
            var values = _.pluck(mac_addresses, 'address');

            return instance.communication.emitAsync('database:monitor:retrieveAll',
                'SELECT * FROM arp WHERE mac_address IN (' + values.map(function () {
                  return '?';
                }) + ');',
              values)
              .then(function (rows) {
                resolve(rows !== undefined && rows !== null && rows.length > 0);
              });
          }
        })
        .catch(function (error) {
          reject(error);
        });
    }

    instance.communication.on('monitor:arp:discover:finish', handleArpDiscover);
  });
};

device.prototype._onCreateOrUpdateDeviceIncomingSynchronization = function (device) {
  return instance.communication.emitAsync('database:person:retrieveAll', 'PRAGMA table_info(device)', [])
    .then(function (rows) {
      device = _.pick(device, _.pluck(rows, 'name'));

      return instance._findById(device.id)
        .then(function (row) {
          if (row !== undefined) {

            if (moment(device.updated_date).isAfter(row.updated_date)) {

              if (row.employee_id !== null && device.employee_id === undefined) {
                device.employee_id = null;
              }

              device = _.omit(device, 'is_present', 'last_presence_date');

              return instance._updateById(device.id, device)
                .then(function () {
                  device = _.extend(device, {
                    is_present: row.is_present,
                    last_presence_date: row.last_presence_date
                  });

                  if (row.employee_id !== null && device.employee_id === null) {
                    instance.communication.emit('person:device:removedFromEmployee', device, {id: row.employee_id});
                  } else if (row.employee_id === null && device.employee_id !== null) {
                    instance.communication.emit('person:device:addedToEmployee', device, {id: device.employee_id});
                  }
                });
            }
          } else {
            return instance._add(device)
              .then(function () {
                if (device.is_present) {
                  return instance._isPresent(device)
                    .then(function (is_present) {

                      if (!is_present) {
                        device.updated_date = new Date();
                        device.is_present = false;
                        device.is_synced = false;

                        return instance._updateById(device.id, device)
                          .then(function () {
                            instance.communication.emit('person:device:offline', device);
                          });
                      }
                    });
                }
              });
          }
        })
        .catch(function (error) {
          logger.error(error.stack);
        });
    });
};

device.prototype._onDeleteDeviceIncomingSynchronization = function (device) {
  return instance._findById(device.id)
    .then(function (row) {

      if (row !== undefined) {
        return instance._deleteById(device.id)
          .then(function () {
            if (row.is_present) {
              row.is_to_be_deleted = true;

              instance.communication.emit('person:device:offline', row);
            }
          });
      }
    })
    .catch(function (error) {
      logger.error(error.stack);
    });
};

device.prototype._onMacAddressOnline = function (mac_address) {
  if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
    return instance._findById(mac_address.device_id)
      .then(function (device) {

        if (device !== undefined && !device.is_present) {
          device.updated_date = new Date();
          device.is_present = true;
          device.last_presence_date = mac_address.last_presence_date;
          device.is_synced = false;

          return instance._updateById(device.id, device)
            .then(function () {
              instance.communication.emit('person:device:online', device);
            });
        }
      })
      .catch(function (error) {
        logger.error(error.stack);
      });
  }
};

device.prototype._onMacAddressOnlineAgain = function (mac_address) {
  if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
    instance._findById(mac_address.device_id)
      .then(function (device) {
        device.updated_date = new Date();
        device.last_presence_date = mac_address.last_presence_date;
        device.is_synced = false;

        instance._updateById(device.id, device)
          .then(function () {
            instance.communication.emit('person:device:onlineAgain', device);
          });
      });
  }

  if (!mac_address.last_scan_date || moment(mac_address.last_scan_date).isBefore(moment().subtract(1, 'hour'))) {

    mac_address.updated_date = new Date();
    mac_address.last_scan_date = new Date();
    return instance._updateMacAddressByAddress(mac_address.address, mac_address).then(function () {
      instance.communication.emit('worker:job:enqueue', 'person:device:discover', mac_address);
    })
  }
};

device.prototype._onMacAddressOffline = function (mac_address) {
  if (mac_address.device_id !== undefined && mac_address.device_id !== null) {
    return instance._findMacAddressesByDeviceId(mac_address.device_id)
      .then(function (mac_addresses) {

        if (mac_addresses !== undefined) {
          mac_addresses = _.filter(mac_addresses, _.matches({'is_present': 1}));

          if (mac_addresses !== undefined && mac_addresses.length == 0) {
            return instance._findById(mac_address.device_id)
              .then(function (device) {
                device.updated_date = new Date();
                device.is_present = false;
                device.last_presence_date = mac_address.last_presence_date;
                device.is_synced = false;

                return instance._updateById(device.id, device).then(function () {
                  instance.communication.emit('person:device:offline', device);
                });
              });
          }
        }
      })
      .catch(function (error) {
        logger.error(error.stack);
      });
  }
};

device.prototype._onDeviceOutgoingSynchronization = function (params, callback) {
  instance.communication.emit('database:person:retrieveOneByOne', 'SELECT * FROM device WHERE is_synced = 0' +
    (params !== null ? (' AND id = \'' + params.id + '\'') : ''), [], function (error, row) {
    if (error) {
      logger.error(error.stack);
    } else {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
        row.is_present = row.is_present == 1;
        row.is_manual = row.is_manual == 1;

        instance._findMacAddressesByDeviceId(row.id)
          .then(function (macAddresses) {
            row.mac_addresses = {};

            _.forEach(macAddresses, function (macAddress) {
              row.mac_addresses[macAddress.id] = true;
            });

            callback(null, row, function (error) {
              if (error) {
                logger.error(error.stack)
              } else {
                delete row.mac_addresses;

                row.is_synced = true;

                instance._updateById(row.id, row)
                  .catch(function (error) {
                    logger.error(error.stack);
                  });
              }
            });
          });
      }
    }
  });
};

device.prototype._findMacAddressesByDeviceId = function (id) {
  return instance.communication.emitAsync('database:person:retrieveAll',
    "SELECT * FROM mac_address WHERE device_id = ?;", [id])
    .then(function (rows) {
      if (rows !== undefined) {
        _.forEach(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));

          if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
            row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
          }

          if (row.last_scan_date !== undefined && row.last_scan_date !== null) {
            row.last_scan_date = new Date(row.last_scan_date.replace(' ', 'T'));
          }
        });
      }

      return rows;
    });
};

device.prototype._findAllBonjoursByIpAddress = function (ipAddress) {
  return instance.communication.emitAsync('database:monitor:retrieveAll',
    "SELECT * FROM bonjour WHERE ip_address = ?;", [ipAddress])
    .then(function (rows) {
      if (rows !== undefined) {
        _.forEach(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        });
      }

      return rows;
    });
};

device.prototype._findAllUPnPsByIpAddress = function (ipAddress) {
  return instance.communication.emitAsync('database:monitor:retrieveAll',
    "SELECT * FROM upnp WHERE ip_address = ?;", [ipAddress])
    .then(function (rows) {
      if (rows !== undefined) {
        _.forEach(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        });
      }

      return rows;
    });
};

device.prototype._findAllDHCPsByMACAddress = function (macAddress) {
  return instance.communication.emitAsync('database:monitor:retrieveAll',
    "SELECT * FROM dhcp WHERE mac_address = ?;", [macAddress])
    .then(function (rows) {
      if (rows !== undefined) {
        _.forEach(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        });
      }

      return rows;
    });
};

device.prototype._findIpAdressByMacAddress = function (macAddress) {
  return instance.communication.emitAsync('database:monitor:retrieveOne',
    "SELECT ip_address FROM arp WHERE mac_address = ?;", [macAddress]);
};

device.prototype._findById = function (id) {
  return instance.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM device WHERE id = ?;", [id])
    .then(function (row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
          row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
        }
        row.is_present = row.is_present == 1;
        row.is_manual = row.is_manual == 1;
      }

      return row;
    });
};

device.prototype._findByMacAddress = function (macAddress) {
  return instance.communication.emitAsync('database:person:retrieveOne',
    "SELECT d.* FROM device d, mac_address ma WHERE d.id = ma.device_id AND ma.address = ?;", [macAddress])
    .then(function (row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
          row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
        }
      }

      return row;
    });
};

device.prototype._add = function (device) {
  var _device = _.clone(device);

  if (_device.id === undefined || _device.id === null) {
    _device.id = instance._generatePushID();
  }

  if (_device.created_date !== undefined && _device.created_date !== null && _device.created_date instanceof Date) {
    _device.created_date = _device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_device.updated_date !== undefined && _device.updated_date !== null && _device.updated_date instanceof Date) {
    _device.updated_date = _device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_device.last_presence_date !== undefined && _device.last_presence_date !== null && _device.last_presence_date instanceof Date) {
    _device.last_presence_date = _device.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_device);
  var values = _.values(_device);

  return instance.communication.emitAsync('database:person:create',
    'INSERT INTO device (' + keys + ') VALUES (' + values.map(function () {
      return '?';
    }) + ');',
    values).then(function () {
    return _device;
  });
};

device.prototype._updateById = function (id, device) {
  var _device = _.clone(device);

  if (_device.created_date !== undefined && _device.created_date !== null && _device.created_date instanceof Date) {
    _device.created_date = _device.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_device.updated_date !== undefined && _device.updated_date !== null && _device.updated_date instanceof Date) {
    _device.updated_date = _device.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_device.last_presence_date !== undefined && _device.last_presence_date !== null && _device.last_presence_date instanceof Date) {
    _device.last_presence_date = _device.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_device);
  var values = _.values(_device);

  return instance.communication.emitAsync('database:person:update',
    'UPDATE device SET ' + keys.map(function (key) {
      return key + ' = ?';
    }) + ' WHERE id = \'' + id + '\';',
    values);
};

device.prototype._deleteById = function (id) {
  return instance.communication.emitAsync('database:person:delete', 'DELETE FROM device WHERE id = ?;', [id]);
};

device.prototype._updateMacAddressByAddress = function (address, mac_address) {
  var _macAddress = _.clone(mac_address);

  if (_macAddress.created_date !== undefined && _macAddress.created_date !== null && _macAddress.created_date instanceof Date) {
    _macAddress.created_date = _macAddress.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_macAddress.updated_date !== undefined && _macAddress.updated_date !== null && _macAddress.updated_date instanceof Date) {
    _macAddress.updated_date = _macAddress.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_macAddress.last_presence_date !== undefined && _macAddress.last_presence_date !== null && _macAddress.last_presence_date instanceof Date) {
    _macAddress.last_presence_date = _macAddress.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_macAddress.last_scan_date !== undefined && _macAddress.last_scan_date !== null && _macAddress.last_scan_date instanceof Date) {
    _macAddress.last_scan_date = _macAddress.last_scan_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_macAddress);
  var values = _.values(_macAddress);

  return instance.communication.emitAsync('database:person:update',
    'UPDATE mac_address SET ' + keys.map(function (key) {
      return key + ' = ?';
    }) + ' WHERE address = \'' + address + '\';',
    values);
};

var instance = new device();

module.exports = instance;
