/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  _ = require('lodash'),
  Promise = require('bluebird');

var utils = require('../utils.js');

var DHCPRL_UNIX_SOCKET = "/var/run/dhcprl.sock";

function DHCP() {
}

DHCP.prototype.type = "MONITOR";

DHCP.prototype.name = "dhcp";

DHCP.prototype.events = {};

DHCP.prototype.load = function (communication) {
  this.communication = communication;

  if (!require('fs').existsSync(DHCPRL_UNIX_SOCKET)) {
    throw new Error('leased unix socket not available');
  }

  this.start();
};

DHCP.prototype.unload = function () {
  this.stop();
};

DHCP.prototype.start = function () {
  utils.startListening.bind(this)({
    'monitor:dhcp:discover': this._discover.bind(this)
  });

  this.communication.emit('worker:job:enqueue', 'monitor:dhcp:discover', null, {schedule: '1 minute'});
};

DHCP.prototype.stop = function () {
  this.communication.emit('worker:job:dequeue', 'monitor:dhcp:discover');

  utils.stopListening.bind(this)([
    'monitor:dhcp:discover'
  ]);
};

DHCP.prototype._discover = function (params, callback) {
  var _this = this;

  return this._connectDHCPRL()
    .mapSeries(function (dhcp) {
      return _this._createOrUpdate(dhcp)
        .catch(function (error) {
          logger.warn(error.message + ' with dhcp as ' + JSON.stringify(dhcp), error);
        });
    })
    .then(this._clean.bind(this))
    .then(function () {
      callback();
    })
    .catch(function (error) {
      callback(error);
    });
};

DHCP.prototype._connectDHCPRL = function () {
  return new Promise(function (resolve, reject) {
    var timeout, dhcps = [];

    var socket = require('net').createConnection(DHCPRL_UNIX_SOCKET);

    socket.on("connect", function () {
      var buffer = new Buffer([0x00]);
      socket.write(buffer);

      timeout = setTimeout(function () {
        socket.destroy();
      }, 100);
    });

    socket.pipe(require('split')()).on('data', function (line) {
      clearTimeout(timeout);

      if (line && line.length > 0) {
        var values = line.split(';');

        var dhcp = {
          mac_address: values[1],
          hostname: values[2]
        }

        dhcps.push(dhcp);
      }

      socket.destroy();
    });

    socket.on("error", function (data) {
      reject(new Error(data));
    });
    socket.on("timeout", function (data) {
      reject(new Error(data));
    });

    socket.on("close", function () {
      resolve(dhcps);
    });
  })
};

DHCP.prototype._createOrUpdate = function (dhcp) {
  var _this = this;

  return this._findByMACAddressAndHostname(dhcp.mac_address, dhcp.hostname)
    .then(function (row) {

      if (row === undefined) {
        return _this._create(dhcp)
          .then(function () {
            _this.communication.emit('monitor:dhcp:create', dhcp);
          });

      } else {
        dhcp.updated_date = new Date();

        return _this._updateByMACAddressAndHostname(dhcp.mac_address, dhcp.hostname, dhcp)
          .then(function () {
            _this.communication.emit('monitor:dhcp:update', dhcp);
          });
      }
    });
};

DHCP.prototype._create = function (dhcp) {
  var _dhcp = _.clone(dhcp);

  if (_dhcp.created_date && _dhcp.created_date instanceof Date) {
    _dhcp.created_date = _dhcp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_dhcp.updated_date && _dhcp.updated_date instanceof Date) {
    _dhcp.updated_date = _dhcp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_dhcp);
  var values = _.values(_dhcp);

  return this.communication.emitAsync('database:monitor:create',
    'INSERT INTO dhcp (' + keys + ') VALUES (' + values.map(function () {
      return '?';
    }) + ');',
    values).then(function () {
    return _dhcp;
  });
};

DHCP.prototype._findByMACAddressAndHostname = function (mac_address, hostname) {
  return this.communication.emitAsync('database:monitor:retrieveOne',
    'SELECT * FROM dhcp WHERE mac_address = ? AND hostname = ?;', [mac_address, hostname])
    .then(function (row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
      }
      return row;
    });
};

DHCP.prototype._updateByMACAddressAndHostname = function (mac_address, hostname, dhcp) {
  var _dhcp = _.clone(dhcp);

  if (_dhcp.created_date && _dhcp.created_date instanceof Date) {
    _dhcp.created_date = _dhcp.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_dhcp.updated_date && _dhcp.updated_date instanceof Date) {
    _dhcp.updated_date = _dhcp.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_dhcp);
  var values = _.values(_dhcp);

  // TODO: Fix this query by http://stackoverflow.com/questions/603572/how-to-properly-escape-a-single-quote-for-a-sqlite-database
  return this.communication.emitAsync('database:monitor:update',
    'UPDATE dhcp SET ' + keys.map(function (key) {
      return key + ' = ?';
    }) + ' WHERE mac_address = \'' + mac_address + '\' AND hostname = \'' + hostname + '\';',
    values);
};

DHCP.prototype._clean = function () {
  var _this = this;

  var now = new Date();

  return this._deleteAllBeforeDate(new Date(now.setMinutes(now.getMinutes() - 10)))
    .mapSeries(function (dhcp) {
      _this.communication.emit('monitor:dhcp:delete', dhcp);
    });
};

DHCP.prototype._deleteAllBeforeDate = function (oldestDate) {
  var _this = this;

  var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  return this.communication.emitAsync('database:monitor:retrieveAll', 'SELECT * FROM dhcp WHERE updated_date < Datetime(?);', [updatedDate])
    .then(function (rows) {

      return Promise.mapSeries(rows, function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));

          return _this.communication.emitAsync('database:monitor:delete', 'DELETE FROM dhcp WHERE id = ?;', [row.id])
        })
        .then(function () {
          return rows;
        });
    });
};

module.exports = new DHCP();
