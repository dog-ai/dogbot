/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlCreateTableIdentity = "CREATE TABLE IF NOT EXISTS identity (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
  "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "name TEXT NOT NULL" +
  ");"

var sqlCreateTableDevice = "CREATE TABLE IF NOT EXISTS device (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
  "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "identity INTEGER REFERENCES identity(id),"
"mac_address TEXT NOT NULL" +
");"

var sqlSelectFromTableIdentityByName = "SELECT * FROM identity WHERE name LIKE ?;";

var sqlInsertEntryIntoTableIdentity = "INSERT INTO identity (identity) VALUES (?);";

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

  this.moduleManager.emit('database:person:setup', sqlCreateTableIdentity, [], function(error) {
    if (error !== undefined && error !== null) {
      throw new Error(error);
    } else {
      self.start();
    }
  });

  this.moduleManager.emit('database:person:setup', sqlCreateTableDevice, [], function(error) {
    if (error !== undefined && error !== null) {
      throw new Error(error);
    } else {
      self.start();
    }
  });
}

learn.prototype.unload = function() {}

learn.prototype.process = function(message, callback) {

  if (message.substring(0, "!learn".length) === "!learn") {

  }
}

learn.prototype._add = function(name, macAddress) {
    this.moduleManager.emit('database:person:create', sqlInsertEntryIntoTableIdentity, [
            name
        ],
        function(error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {

            }
        }, true);
}

module.exports = new learn();
