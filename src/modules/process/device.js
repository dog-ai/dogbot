/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function device() {
  var moduleManager = {};
}

device.prototype.type = "PROCESS";

device.prototype.name = "device";

device.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

device.prototype.help = function() {
  var help = '';

  help += '*!device* <add|rem|list> [<person name|slack id>] [<device address>] - _Associate a person with a device_';

  return help;
};

device.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
};

device.prototype.unload = function () {
};

device.prototype.process = function(message, callback) {

  if (message.substring(0, "!device".length) === "!device") {
    var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

    if (fields !== null && fields.length > 1) {
      var operation = fields[1];

      if (operation === 'add' && fields.length == 4) {
        fields[2] = fields[2].replace(/"/g, '');

        var name = undefined;
        var slackId = undefined;

        if (fields[2].charAt(0) === '<') {
          slackId = fields[2].substring(2, fields[2].length - 1);
        } else {
          name = fields[2];
        }

        var macAddress = fields[3].replace(/"/g, '');

        var macAddressRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
        if (!macAddressRegex.test(macAddress)) {
          return callback('Please, give me a proper MAC address, i.e. ce:48:d2:28:e4:56');
        }

        this._add(name, slackId, macAddress, callback);
      } else if (operation === 'rem' && fields.length == 4) {
        fields[2] = fields[2].replace(/"/g, '');

        var name = undefined;
        var slackId = undefined;

        if (fields[2].charAt(0) === '<') {
          slackId = fields[2].substring(2, fields[2].length - 1);
        } else {
          name = fields[2];
        }

        var macAddress = fields[3].replace(/"/g, '');

        var macAddressRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
        if (!macAddressRegex.test(macAddress)) {
          return callback('Please, give me a proper MAC address, i.e. ce:48:d2:28:e4:56');
        }

        this._rem(name, slackId, macAddress, callback);
      } else if (operation === 'list' && fields.length == 2) {
        this._retrieve(callback);
      }
    }
  }
};

device.prototype._add = function (name, slackId, macAddress, callback) {
  var self = this;

  this.moduleManager.emit('database:person:retrieveOne',
      "SELECT * FROM employee WHERE " + (name !== undefined ? "name" : "slack_id") + " LIKE ?;",
      [name !== undefined ? name : slackId],
    function(error, row) {
      if (error) {
        throw error;
      } else {
        if (row) {
          callback('I\'m not aware of any person named ' + (name !== undefined ? name : "<@" + slackId + ">"));
        } else {

          self.moduleManager.emit('database:person:create',
              "INSERT INTO device (employee, mac_address) VALUES (?, ?);", [
              row.id,
              macAddress
            ],
              function (error) {
              if (error !== undefined && error !== null) {
                throw error;
              } else {
                callback('Added device with address ' + macAddress + ' to ' + (name !== undefined ? name : "<@" + slackId + ">"));
              }
            });
        }

      }
    });
};

device.prototype._rem = function (name, slackId, macAddress, callback) {
  var self = this;

  this.moduleManager.emit('database:person:retrieveOne',
      "SELECT * FROM employee WHERE " + (name !== undefined ? "name" : "slack_id") + " LIKE ?;",
      [name !== undefined ? name : slackId],
      function(error, row) {
        if (error) {
          throw error;
        } else {
          if (row) {
            callback('I\'m not aware of any person named ' + name);
          } else {

            self.moduleManager.emit('database:person:delete',
                "DELETE FROM device WHERE employee = ? AND mac_address = ?;", [
                  row.id,
                  macAddress
                ],
                function(error, rowId, changes) {
                  if (error !== undefined && error !== null) {
                    throw error;
                  } else {
                    if (changes === 0) {
                      callback('I\'m not aware that ' + name + ' has any device with the address ' + macAddress);
                    } else {
                      callback('Removed device with address ' + macAddress + ' from ' + (name !== undefined ? name : "<@" + slackId + ">"));
                    }
                  }
                });
          }

        }
      });
};

device.prototype._retrieve = function (callback) {
  this.moduleManager.emit('database:person:retrieveOneByOne',
      "SELECT e.name, d.mac_address FROM employee e, device d WHERE e.id = d.employee ORDER BY e.id ASC, d.id ASC;", [],
      function(error, row) {
        if (error) {
          throw error;
        } else {
          if (row) {
            callback(row.name + ' has device with address ' + row.mac_address);
          }
        }
      });
};

module.exports = new device();
