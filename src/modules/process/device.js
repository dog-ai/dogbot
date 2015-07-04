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

  help += '*!device* <add|rem|list> [<person name>] [<device address>] - _Associate a person with a device_';

  return help;
};

device.prototype.load = function(moduleManager) {
  var self = this;

  this.moduleManager = moduleManager;

  this.moduleManager.emit('database:person:setup',
      "CREATE TABLE IF NOT EXISTS user (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "name TEXT NOT NULL UNIQUE" +
    ");", [],
    function(error) {
      if (error !== undefined && error !== null) {
        throw new Error(error);
      }
    });

  this.moduleManager.emit('database:person:setup',
    "CREATE TABLE IF NOT EXISTS device (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
    "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
    "user INTEGER REFERENCES user(id), " +
    "mac_address TEXT NOT NULL, " +
    "UNIQUE(user, mac_address)" +
    ");", [],
    function(error) {
      if (error !== undefined && error !== null) {
        throw new Error(error);
      }
    });
};

device.prototype.unload = function () {
};

device.prototype.process = function(message, callback) {

  if (message.substring(0, "!device".length) === "!device") {
    var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

    if (fields !== null && fields.length > 1) {
      var operation = fields[1];

      if (operation === 'add' && fields.length == 4) {
        var name = fields[2].replace(/"/g, '');
        var macAddress = fields[3].replace(/"/g, '');

        var macAddressRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
        if (!macAddressRegex.test(macAddress)) {
          return callback('Please, give me a proper MAC address, i.e. ce:48:d2:28:e4:56');
        }

        this._add(name, macAddress, callback);
      } else if (operation === 'rem' && fields.length == 4) {
        var name = fields[2].replace(/"/g, '');
        var macAddress = fields[3].replace(/"/g, '');

        var macAddressRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i;
        if (!macAddressRegex.test(macAddress)) {
          return callback('Please, give me a proper MAC address, i.e. ce:48:d2:28:e4:56');
        }
        
        this._rem(name, macAddress, callback);
      } else if (operation === 'list' && fields.length == 2) {
        this._retrieve(callback);
      }
    }
  }
};

device.prototype._add = function(name, macAddress, callback) {
  var self = this;

  this.moduleManager.emit('database:person:retrieve',
      "SELECT * FROM user WHERE name LIKE ?;", [name],
    function(error, row) {
      if (error !== null) {
        throw error;
      } else {
        if (row === undefined) {

          self.moduleManager.emit('database:person:create',
              "INSERT INTO user (name) VALUES (?);", [
              name
            ],
            function(error, rowId) {
              if (error !== undefined && error !== null) {
                throw error;
              } else {
                self.moduleManager.emit('database:person:create',
                    "INSERT INTO device (user, mac_address) VALUES (?, ?);", [
                    rowId,
                    macAddress
                  ],
                  function(error, rowId) {
                    if (error !== undefined && error !== null) {
                      throw error;
                    } else {
                      callback('Added device with address ' + macAddress + ' to ' + name);
                    }
                  });
              }
            });

        } else {

          self.moduleManager.emit('database:person:create',
              "INSERT INTO device (user, mac_address) VALUES (?, ?);", [
              row.id,
              macAddress
            ],
            function(error, rowId) {
              if (error !== undefined && error !== null) {
                throw error;
              } else {
                callback('Added device with address ' + macAddress + ' to ' + name);
              }
            });
        }

      }
    });
};

device.prototype._rem = function(name, macAddress, callback) {
  var self = this;

  this.moduleManager.emit('database:person:retrieve',
      "SELECT * FROM user WHERE name LIKE ?;", [name],
      function(error, row) {
        if (error !== null) {
          throw error;
        } else {
          if (row === undefined) {
            callback('I\'m not aware of any person named ' + name);
          } else {

            self.moduleManager.emit('database:person:delete',
                "DELETE FROM device WHERE user = ? AND mac_address = ?;", [
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
                      callback('Removed device with address ' + macAddress + ' from ' + name);
                    }
                  }
                });
          }

        }
      });
};

device.prototype._retrieve = function (callback) {
  this.moduleManager.emit('database:person:retrieveAll',
      "SELECT u.name, d.mac_address FROM user u, device d WHERE u.id = d.user ORDER BY u.id ASC, d.id ASC;", [],
      function(error, row) {
        if (error !== null) {
          throw error;
        } else {
          if (row !== undefined) {
            callback(row.name + ' has device with address ' + row.mac_address);
          }
        }
      });
};

module.exports = new device();
