/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  _ = require('lodash'),
  Promise = require('bluebird');

var utils = require('../utils.js');

function ARP() {
}

ARP.prototype.type = 'monitor';

ARP.prototype.name = 'arp';

ARP.prototype.events = {};

ARP.prototype.info = function () {
  return '*' + this.name + '* - ' +
    '_' + this.name.toUpperCase() + ' ' +
    this.type.toLowerCase() + ' module_';
};

ARP.prototype.load = function (communication) {
  this.communication = communication;

  this.start();
};

ARP.prototype.unload = function () {
  this.stop();
};

ARP.prototype.start = function () {
  utils.startListening.bind(this)({
    'monitor:arp:discover': this._discover.bind(this),
    'monitor:arp:resolve': this._resolve.bind(this),
    'monitor:ip:create': this._onIPCreateOrUpdate.bind(this),
    'monitor:ip:update': this._onIPCreateOrUpdate.bind(this)
  });

  this.communication.emit('worker:job:enqueue', 'monitor:arp:discover', null, '1 minute');
};

ARP.prototype.stop = function () {
  this.communication.emit('worker:job:dequeue', 'monitor:arp:discover');

  utils.stopListening.bind(this)([
    'monitor:arp:discover',
    'monitor:arp:resolve',
    'monitor:ip:create',
    'monitor:ip:update'
  ]);
};


ARP.prototype._onIPCreateOrUpdate = function (ip) {
  var _this = this;

  return this._findByIPAddress(ip.ip_address)
    .then(function (arp) {

      if (!arp) {

        _this.communication.emit('worker:job:enqueue', 'monitor:arp:resolve', ip.ip_address);

      } else {

        arp.updated_date = new Date();

        return _this._updateByIPAddressAndMACAddress(arp.ip_address, arp.mac_address, arp)
          .then(function () {
            _this.communication.emit('monitor:arp:update', arp);
          });

      }
    });
};


ARP.prototype._discover = function (params, callback) {
  var _this = this;

  this.communication.emit('monitor:arp:discover:begin');

  return this._execArpScan()
    .mapSeries(function (arp) {
      return _this._createOrUpdate(arp)
        .catch(function (error) {
          logger.warn(error.message, error);
        });
    })
    .then(_this._clean.bind(this))
    .then(function () {
      callback();
    })
    .catch(callback)
    .finally(function () {
      _this.communication.emit('monitor:arp:discover:finish');
    });
};

ARP.prototype._resolve = function (ipAddress, callback) {
  var _this = this;

  return this._execArp(ipAddress)
    .then(function (macAddress) {

      if (!macAddress) {
        return;
      }
      
      var arp = {
        ip_address: ipAddress,
        mac_address: macAddress
      };

      return _this._createOrUpdate(arp);
    })
    .then(function () {
      callback();
    })
    .catch(callback)
};

ARP.prototype._clean = function () {
  var _this = this;

  var currentDate = new Date();

  return this._deleteAllBeforeDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)))
    .mapSeries(function (arp) {
      _this.communication.emit('monitor:arp:delete', arp);
    });

};


ARP.prototype._execArpScan = function () {
  return new Promise(function (resolve, reject) {

    var result = [];

    var _interface = process.platform === 'linux' ? 'wlan0' : 'en0';

    var spawn = require('child_process').spawn;
    var _process = spawn('arp-scan', [
      '--interface=' + _interface,
      '--localnet',
      '--numeric', // IP addresses only, no hostnames.
      '--quiet',
      '--ignoredups', // Don't display duplicate packets.
      '--timeout=1000', // Set initial per host timeout to ms.
      '--retry=4',
      '--plain' // Display plain output showing only responding hosts.
    ]);


    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      var values = line.split('\t');

      var arp = {
        ip_address: values[0],
        mac_address: values[1]
      };

      if (arp.ip_address && arp.ip_address.length > 0 &&
        arp.mac_address && arp.mac_address.length > 0) {

        result.push(arp);

      }
    });

    _process.stderr.on('data', function (data) {
      reject(new Error(data));
    });

    _process.on('error', reject);
    _process.on('close', function () {
      resolve(result);
    });
  });
};

ARP.prototype._execArp = function (ipAddress) {
  return new Promise(function (resolve, reject) {

    var result;

    var spawn = require('child_process').spawn,
      _process = spawn('arp', [
        '-n',
        ipAddress
      ]);

    _process.stdout.setEncoding('utf8');
    _process.stdout.pipe(require('split')()).on('data', function (line) {
      if (line !== null && line.length === 0 || line.lastIndexOf('A', 0) === 0) {

      } else {
        var values = line.replace(/\s\s+/g, ' ').split(' ');

        var macAddress;
        if (process.platform === 'linux') {
          macAddress = values[2];
        } else {
          macAddress = values[3];

          if (macAddress.indexOf(':') > -1) { // fix malformed MAC addresses coming from OSX arp binary
            values = macAddress.split(':');
            macAddress = '';
            for (var i = 0; i < values.length; i++) {
              if (values[i].length == 1) {
                values[i] = '0' + values[i];
              }

              if (macAddress !== '') {
                macAddress += ':';
              }

              macAddress += values[i];
            }
          }
        }

        if (!/^(([a-f0-9]{2}:){5}[a-f0-9]{2},?)+$/i.test(macAddress)) {
          macAddress = undefined;
        }

        result = macAddress;
      }
    });

    _process.stderr.on('data', function (data) {
      reject(new Error(data));
    });

    _process.on('error', reject);
    _process.on('close', function () {
      resolve(result);
    });

  });
};


ARP.prototype._createOrUpdate = function (arp) {
  var _this = this;

  return this._findByIPAddress(arp.ip_address)
    .then(function (row) {

      if (!row) {

        return _this._create(arp.ip_address, arp.mac_address, arp)
          .then(function () {
            _this.communication.emit('monitor:arp:create', arp);
          });

      } else {

        row.updated_date = new Date();

        return _this._updateByIPAddressAndMACAddress(row.ip_address, row.mac_address, row)
          .then(function () {
            _this.communication.emit('monitor:arp:update', row);
          });
      }
    });
};

ARP.prototype._create = function (ipAddress, macAddress, arp) {
  var _arp = _.clone(arp);

  if (_arp.created_date && _arp.created_date instanceof Date) {
    _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_arp.updated_date && _arp.updated_date instanceof Date) {
    _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }
  
  var keys = _.keys(_arp);
  var values = _.values(_arp);

  return this.communication.emitAsync('database:monitor:create',
    'INSERT INTO arp (' + keys + ') VALUES (' + values.map(function () {
      return '?';
    }) + ');',
    values);
};

ARP.prototype._updateByIPAddressAndMACAddress = function (ipAddress, macAddress, arp) {
  var _arp = _.clone(arp);

  if (_arp.created_date && _arp.created_date instanceof Date) {
    _arp.created_date = _arp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_arp.updated_date && _arp.updated_date instanceof Date) {
    _arp.updated_date = _arp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_arp);
  var values = _.values(_arp);

  return this.communication.emitAsync('database:monitor:update',
    'UPDATE arp SET ' + keys.map(function (key) {
      return key + ' = ?';
    }) + ' WHERE ip_address = \'' + ipAddress + '\' AND mac_address = \'' + macAddress + '\';',
    values);
};

ARP.prototype._findByIPAddress = function (ipAddress) {
  return this.communication.emitAsync('database:monitor:retrieveOne', 'SELECT * FROM arp WHERE ip_address = ?;', [ipAddress])
    .then(function (row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
      }
      return row;
    });
};

ARP.prototype._deleteAllBeforeDate = function (date) {
  var _this = this;

  var updatedDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  return this.communication.emitAsync('database:monitor:retrieveAll', 'SELECT * FROM arp WHERE updated_date < Datetime(?);', [updatedDate])
    .then(function (rows) {

      return Promise.mapSeries(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));

          return _this.communication.emitAsync('database:monitor:delete', 'DELETE FROM arp WHERE id = ?;', [row.id]);
        })
        .then(function () {
          return rows;
        });
    })

};

module.exports = new ARP();
