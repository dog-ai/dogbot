/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function learn() {
  var moduleManager = {};
}

learn.prototype.type = "PROCESS";

learn.prototype.name = "learn";

learn.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

learn.prototype.help = function() {
  var help = '';

  help += '*!learn* <person name> <device address>- _Associate a person with a device_'

  return help;
}

learn.prototype.load = function(moduleManager) {
  var self = this;

  this.moduleManager = moduleManager;

  this.moduleManager.emit('database:person:setup',
    "CREATE TABLE IF NOT EXISTS identity (" +
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
    "identity INTEGER REFERENCES identity(id), " +
    "mac_address TEXT NOT NULL, " +
    "UNIQUE(identity, mac_address)" +
    ");", [],
    function(error) {
      if (error !== undefined && error !== null) {
        throw new Error(error);
      }
    });
}

learn.prototype.unload = function() {}

learn.prototype.process = function(message, callback) {

  if (message.substring(0, "!learn".length) === "!learn") {
    var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);
    if (fields !== null && fields.length > 1) {
      var operation = fields[1];

      if (operation === 'add') {
        var name = fields[2].replace(/"/g, '');
        var macAddress = fields[3].replace(/"/g, '');
        this._add(name, macAddress, callback);
      } else if (operation === 'rem') {

      } else if (operation === 'list') {

      }
    }
  }
}

learn.prototype._add = function(name, macAddress, callback) {
  var self = this;

  self.moduleManager.emit('database:person:retrieve',
    "SELECT * FROM identity WHERE name LIKE ?;", [name],
    function(error, row) {
      if (error !== null) {
        console.error(error);
      } else {
        if (row === undefined) {

          self.moduleManager.emit('database:person:create',
            "INSERT INTO identity (name) VALUES (?);", [
              name
            ],
            function(error, rowId) {
              if (error !== undefined && error !== null) {
                console.error(error);
              } else {
                self.moduleManager.emit('database:person:create',
                  "INSERT INTO device (identity, mac_address) VALUES (?, ?);", [
                    rowId,
                    macAddress
                  ],
                  function(error, rowId) {
                    if (error !== undefined && error !== null) {
                      console.error(error);
                    } else {
                      callback('Added device with address ' + macAddress + ' to ' + name);
                    }
                  });
              }
            });

        } else {

          self.moduleManager.emit('database:person:create',
            "INSERT INTO device (identity, mac_address) VALUES (?, ?);", [
              row.id,
              macAddress
            ],
            function(error, rowId) {
              if (error !== undefined && error !== null) {
                console.error(error);
              } else {
                callback('Added device with address ' + macAddress + ' to ' + name);
              }
            });
        }

      }
    });
}

module.exports = new learn();
