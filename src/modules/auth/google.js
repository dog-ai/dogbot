/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var sqlCreateTable = "CREATE TABLE IF NOT EXISTS google (" +
  "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
  "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
  "user_id TEXT NOT NULL, " +
  "name TEXT NOT NULL, " +
  "email TEXT NOT NULL, " +
  "access_token TEXT NOT NULL, " +
  "expires_in INTEGER NOT NULL, " +
  "refresh_token TEXT NOT NULL" +
  ");"

var sqlInsertEntryIntoTable = "INSERT INTO google (user_id, name, email, access_token, expires_in, refresh_token) VALUES (?, ?, ?, ?, ?, ?);";

var sqlUpdateTableEntryByUserId = "UPDATE google SET updated_date = ?, name = ?, email = ?, access_token = ?, expires_in = ?, refresh_token = ? WHERE user_id = ? ;";

var sqlSelectAllFromTable = "SELECT * FROM google;";

var sqlSelectFromTableByUserId = "SELECT * FROM google WHERE user_id = ?;";

var sqlDeleteFromTableOldEntries = "DELETE FROM google WHERE updated_date < ?";

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var refresh = require('passport-oauth2-refresh');

function google() {
  var moduleManager = {};
}

google.prototype.type = "AUTH";

google.prototype.name = "google";

google.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

google.prototype.load = function(moduleManager) {
  var self = this;

  this.moduleManager = moduleManager;

  this.moduleManager.emit('database:auth:setup', sqlCreateTable, [], function(error) {
    if (error !== undefined && error !== null) {
      throw new Error(error);
    } else {
      self.start();
    }
  });
}

google.prototype.unload = function() {}

google.prototype.start = function() {
  var self = this;

  var web = this.moduleManager.findLoadedModuleByName('web');

  var strategy = new GoogleStrategy({
      clientID: '426704701102-im8l4oaf1au7gn0msvsupek91frqlr0p.apps.googleusercontent.com',
      clientSecret: 'W6DbtssQ4VJTX0f6JpLQdwOA',
      scope: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar'],
      callbackURL: "http://localhost:8082/auth/google/callback"
    },
    function(accessToken, refreshToken, params, profile, done) {
      self.moduleManager.emit('database:auth:retrieve', sqlSelectFromTableByUserId, [profile.id],
        function(error, row) {
          if (error !== null) {
            console.error(error);
          } else {
            if (row === undefined) {
              self._add(profile.id, profile.displayName, profile.emails[0].value, accessToken, params.expires_in, refreshToken);
            } else {
              self._update(profile.id, profile.displayName, profile.emails[0].value, accessToken, params.expires_in, refreshToken);
            }
          }
        });

      return done(null, profile);
    }
  );

  web.registerAuthStrategy(this.name, strategy);

  refresh.use(strategy);
}

google.prototype.stop = function() {}

google.prototype.getAccounts = function(callback) {
  this.moduleManager.emit('database:auth:retrieveAll', sqlSelectAllFromTable, [], function(error, rows) {
    if (error !== null) {
      callback(error);
    } else {
      if (rows !== undefined) {
        callback(null, rows);
      }
    }
  });
}

google.prototype.refreshAuth = function(accountId, callback) {
  var self = this;

  this.moduleManager.emit('database:auth:retrieve', sqlSelectFromTableByUserId, [accountId],
    function(error, row) {
      if (error !== null) {
        console.error(error);
      } else {
        if (row !== undefined) {
          refresh.requestNewAccessToken('google', row.refresh_token, function(error, accessToken) {
            if (error !== undefined && error !== null) {
              console.error(error);
            } else {
              row.access_token = accessToken;
              self._update(row.user_id, row.name, row.email, row.access_token, row.expires_in, row.refresh_token);

              callback(row);
            }
          });
        }
      }
    });
}

google.prototype._add = function(userId, name, email, accessToken, expiresIn, refreshToken) {

  this.moduleManager.emit('database:auth:create', sqlInsertEntryIntoTable, [
      userId,
      name,
      email,
      accessToken,
      expiresIn,
      refreshToken
    ],
    function(error) {
      if (error !== undefined && error !== null) {
        console.error(error);
      } else {

      }
    });
}

google.prototype._update = function(userId, name, email, accessToken, expiresIn, refreshToken) {

  var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

  this.moduleManager.emit('database:auth:update', sqlUpdateTableEntryByUserId, [
      updatedDate,
      name,
      email,
      accessToken,
      expiresIn,
      refreshToken,
      userId
    ],
    function(error, lastId, changes) {
      if (error !== undefined && error !== null) {
        console.error(error);
      } else {}
    });
}

module.exports = new google();
