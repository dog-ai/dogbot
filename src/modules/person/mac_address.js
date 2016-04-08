/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  _ = require('lodash'),
  moment = require('moment'),
  macvendor = require('macvendor'),
  Promise = require("bluebird");

function mac_address() {
  var communication = undefined;
}

mac_address.prototype.type = "PERSON";

mac_address.prototype.name = "mac_address";

mac_address.prototype.info = function () {
  return "*" + this.name + "* - " +
    "_" + this.name.toUpperCase() + " " +
    this.type.toLowerCase() + " module_";
};

mac_address.prototype.load = function (communication) {
  this.communication = communication;

  this.start();
};

mac_address.prototype.unload = function () {
  this.stop();
};

mac_address.prototype.start = function () {
  this.communication.on('person:macAddress:clean', this._clean);
  this.communication.on('monitor:arp:create', this._onArpCreateOrUpdate);
  this.communication.on('monitor:arp:update', this._onArpCreateOrUpdate);
  this.communication.on('monitor:arp:delete', this._onArpDelete);
  this.communication.on('sync:incoming:person:macAddress:create', this._onCreateOrUpdateMacAddressIncomingSynchronization);
  this.communication.on('sync:incoming:person:macAddress:update', this._onCreateOrUpdateMacAddressIncomingSynchronization);
  this.communication.on('sync:incoming:person:macAddress:delete', this._onDeleteMacAddressIncomingSynchronization);
  this.communication.on('sync:outgoing:person:mac_address', this._onMacAddressOutgoingSynchronization);

  this.communication.emit('worker:job:enqueue', 'person:macAddress:clean', null, '6 hours');

  this.communication.emitAsync('sync:incoming:register:setup', {
    companyResource: 'mac_addresses',
    onCompanyResourceAddedCallback: function (macAddress) {
      instance.communication.emit('sync:incoming:person:macAddress:create', macAddress);
    },
    onCompanyResourceChangedCallback: function (macAddress) {
      instance.communication.emit('sync:incoming:person:macAddress:update', macAddress);
    },
    onCompanyResourceRemovedCallback: function (macAddress) {
      instance.communication.emit('sync:incoming:person:macAddress:delete', macAddress);
    }
  });

  this.communication.emitAsync('sync:outgoing:periodic:register', {
    companyResource: 'mac_addresses',
    event: 'sync:outgoing:person:mac_address'
  });

  this.communication.emit('sync:outgoing:quickshot:register', {
    companyResource: 'mac_addresses',
    registerEvents: ['person:device:discover:create'],
    outgoingFunction: this._onDeviceDiscoverCreate
  });
};

mac_address.prototype.stop = function () {
  this.communication.removeListener('person:macAddress:clean', this._clean);
  this.communication.removeListener('monitor:arp:create', this._onArpCreateOrUpdate);
  this.communication.removeListener('monitor:arp:update', this._onArpCreateOrUpdate);
  this.communication.removeListener('monitor:arp:delete', this._onArpDelete);
  this.communication.removeListener('sync:incoming:person:macAddress:create', this._onCreateOrUpdateMacAddressIncomingSynchronization);
  this.communication.removeListener('sync:incoming:person:macAddress:update', this._onCreateOrUpdateMacAddressIncomingSynchronization);
  this.communication.removeListener('sync:incoming:person:macAddress:delete', this._onDeleteMacAddressIncomingSynchronization);
  this.communication.removeListener('sync:outgoing:person:mac_address', this._onMacAddressOutgoingSynchronization);
};

mac_address.prototype._clean = function (params, callback) {
  instance._findAllBeforeLastPresenceDateAndWithoutDevice(moment().subtract(1, 'month').toDate())
    .then(function (rows) {
      if (rows !== undefined) {
        var promises = [];

        _.forEach(rows, function (row) {
          row.is_to_be_deleted = true;
          row.is_synced = false;
          row.updated_date = new Date();

          promises.push(instance._updateByAddress(row.address, row));
        });

        return Promise.all(promises);
      }
    })
    .then(function () {
      callback();
    })
    .catch(function (error) {
      callback(error);
    });
};

mac_address.prototype._onDeviceDiscoverCreate = function (device, callback) {
  instance._findAllByDeviceId(device.id)
    .mapSeries(function (macAddress) {
      return instance._onMacAddressOutgoingSynchronization(macAddress, callback);
    })
};

mac_address.prototype._onArpCreateOrUpdate = function (arp) {
  instance._findByAddress(arp.mac_address, function (error, row) {

    if (error) {
      logger.error(error.stack);
    } else {
      var now = new Date();

      if (row !== undefined) {

        var was_present = row.is_present;

        row.updated_date = now;
        row.is_present = true;
        row.last_presence_date = now;
        row.is_synced = false;

        instance._updateByAddress(row.address, row)
          .then(function () {
            if (was_present) {
              instance.communication.emit('person:mac_address:onlineAgain', row);
            } else {
              instance.communication.emit('person:mac_address:online', row);
            }

            // lookup vendor
            if (row.vendor === undefined || row.vendor === null || row.vendor.length > 60 ||
              row.vendor === row.vendor.toUpperCase() ||
              /(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/gi.test(row.vendor)
            ) {

              macvendor(row.address, function (error, vendor) {
                if (error) {
                  logger.error(error.stack);
                } else {
                  if (vendor !== undefined && vendor !== null && vendor.length < 60) {
                    row.vendor = vendor.toLowerCase().replace(/(?:^|\s)\S/g, function (s) {
                      return s.toUpperCase();
                    });
                    row.vendor = row.vendor.replace(/(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/gi, '');
                    row.is_synced = false;
                    row.updated_date = new Date();

                    instance._updateByAddress(row.address, row)
                      .catch(function (error) {
                        logger.error(error.stack);
                      });
                  }
                }
              });
            }
          }).catch(function (error) {
          logger.error(error.stack);
        });
      } else {

        row = {
          address: arp.mac_address,
          created_date: now,
          updated_date: now,
          last_presence_date: now,
          is_present: true,
          is_synced: false
        };

        instance._add(row, function (error) {
          if (error) {
            logger.error(error.stack);
          } else {
            row.last_presence_date = now;
            instance.communication.emit('person:mac_address:online', row);

            // lookup vendor
            macvendor(row.address, function (error, vendor) {
              if (error) {
                logger.error(error.stack);
              } else {
                if (vendor !== undefined && vendor !== null && vendor.length < 60) {
                  row.vendor = vendor.replace(/(?:^|\s)\S/g, function (s) {
                    return s.toUpperCase();
                  });
                  row.vendor = row.vendor.replace(/(,(\s)?|(\s)?inc\.|(\s)?corporate|(\s)?corp|(\s)?co\.|(\s)?ltd|\.com)/, '');
                  row.is_synced = false;
                  row.updated_date = new Date();

                  instance._updateByAddress(row.address, row)
                    .catch(function (error) {
                      logger.error(error.stack);
                    });
                }
              }
            });
          }
        });
      }
    }
  });
};

mac_address.prototype._onArpDelete = function (arp) {
  instance._findByAddress(arp.mac_address, function (error, row) {
    if (error) {
      logger.error(error.stack);
    } else {

      if (row !== undefined) {
        var now = new Date();

        row.updated_date = now;
        row.is_present = false;
        row.is_synced = false;
        row.last_presence_date = arp.updated_date;

        instance._updateByAddress(row.address, row)
          .then(function () {
            instance.communication.emit('person:mac_address:offline', row);
          })
          .catch(function (error) {
            logger.error(error.stack);
          });
      }
    }

  });
};

mac_address.prototype._onCreateOrUpdateMacAddressIncomingSynchronization = function (mac_address) {
  instance.communication.emit('database:person:retrieveAll', 'PRAGMA table_info(mac_address)', [], function (error, rows) {
    if (error) {
      logger.error(error.stack);
    } else {

      // filter only required mac_address properties
      mac_address = _.pick(mac_address, _.pluck(rows, 'name'));
      mac_address.is_synced = true;

      instance._findByAddress(mac_address.address, function (error, row) {
        if (error) {
          logger.error(error.stack);
        } else {
          if (row !== undefined) {
            if (moment(mac_address.updated_date).isAfter(row.updated_date)) {

              if (row.device_id !== undefined && mac_address.device_id === undefined) {
                mac_address.device_id = null;
              }

              instance._updateByAddress(mac_address.address, mac_address)
                .catch(function (error) {
                  logger.error('Failed to synchronize MAC address from server: ' + JSON.stringify(mac_address) + ' due to: ' + error);
                });
            }
          } else {
            instance._add(mac_address, function (error) {
              if (error) {
                logger.error('Failed to synchronize MAC address from server: ' + JSON.stringify(mac_address) + ' due to: ' + error);
              }
            });
          }
        }
      });
    }
  });
};

mac_address.prototype._onDeleteMacAddressIncomingSynchronization = function (macAddress) {
  instance.communication.emit('database:person:delete',
    'SELECT * FROM mac_address WHERE id = ?',
    [macAddress.id], function (error, row) {
      if (error) {
        logger.error(error.stack);
      } else {
        instance.communication.emit('database:person:delete',
          'DELETE FROM mac_address WHERE id = ?',
          [macAddress.id], function (error) {
            if (error) {
              logger.error(error.stack);
            } else {
              if (row.is_present) {
                instance.communication.emit('person:mac_address:offline', row);
              }
            }
          });
      }
    });
};

mac_address.prototype._onMacAddressOutgoingSynchronization = function (params, callback) {
  instance.communication.emit('database:person:retrieveOneByOne',
    'SELECT * FROM mac_address WHERE is_synced = 0' +
    (params !== null ? (' AND id = \'' + params.id + '\'') : ''), [], function (error, row) {
      if (error) {
        logger.error(error.stack);
      } else {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
          row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
          if (row.last_scan_date !== undefined && row.last_scan_date !== null) {
            row.last_scan_date = new Date(row.last_scan_date.replace(' ', 'T'));
          }
          row.is_present = row.is_present == 1;

          callback(error, row, function (error, mac_address) {
            if (error) {
              logger.error(error.stack)
            } else {
              if (mac_address.is_to_be_deleted) {
                instance._deleteById(row.id)
                  .catch(function (error) {
                    logger.error(error.stack);
                  });
              } else {
                row.id = mac_address.id;
                row.is_synced = true;

                instance._updateByAddress(row.address, row)
                  .catch(function (error) {
                    logger.error(error.stack);
                  });
              }
            }
          });
        }
      }
    });
};

mac_address.prototype._findByAddress = function (mac_address, callback) {
  this.communication.emit('database:person:retrieveOne',
    "SELECT * FROM mac_address WHERE address = ?;", [mac_address], function (error, row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));

        if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
          row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
        }

        if (row.last_scan_date !== undefined && row.last_scan_date !== null) {
          row.last_scan_date = new Date(row.last_scan_date.replace(' ', 'T'));
        }
      }

      callback(error, row);
    });
};

mac_address.prototype._findAllByDeviceId = function (deviceId) {
  return this.communication.emitAsync('database:person:retrieveAll',
    "SELECT * FROM mac_address WHERE device_id = ?;",
    [deviceId]
  );
};

mac_address.prototype._generatePushID = (function () {
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

mac_address.prototype._add = function (mac_address, callback) {

  if (mac_address.id === undefined || mac_address.id === null) {
    mac_address.id = instance._generatePushID();
  }

  if (mac_address.created_date !== undefined && mac_address.created_date !== null && mac_address.created_date instanceof Date) {
    mac_address.created_date = mac_address.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (mac_address.updated_date !== undefined && mac_address.updated_date !== null && mac_address.updated_date instanceof Date) {
    mac_address.updated_date = mac_address.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (mac_address.last_presence_date !== undefined && mac_address.last_presence_date !== null && mac_address.last_presence_date instanceof Date) {
    mac_address.last_presence_date = mac_address.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (mac_address.last_scan_date !== undefined && mac_address.last_scan_date !== null && mac_address.last_scan_date instanceof Date) {
    mac_address.last_scan_date = mac_address.last_scan_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(mac_address);
  var values = _.values(mac_address);

  this.communication.emit('database:person:create',
    'INSERT INTO mac_address (' + keys + ') VALUES (' + values.map(function () {
      return '?';
    }) + ');',
    values,
    callback);
};

mac_address.prototype._findAllBeforeLastPresenceDateAndWithoutDevice = function (lastPresenceDate) {
  lastPresenceDate = lastPresenceDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  return this.communication.emitAsync('database:person:retrieveAll',
    "SELECT * FROM mac_address WHERE last_presence_date < Datetime(?) AND device_id IS NULL;",
    [lastPresenceDate]
  );
};

mac_address.prototype._updateByAddress = function (address, mac_address) {
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

mac_address.prototype._deleteById = function (id) {
  return instance.communication.emitAsync('database:person:delete', 'DELETE FROM mac_address WHERE id = ?;', [id]);
};

var instance = new mac_address();

module.exports = instance;
