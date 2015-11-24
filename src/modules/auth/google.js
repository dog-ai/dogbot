/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

var sqlInsertEntryIntoTable = "INSERT INTO google (user_id, name, email, access_token, expires_in, refresh_token) VALUES (?, ?, ?, ?, ?, ?);";

var sqlUpdateTableEntryByUserId = "UPDATE google SET updated_date = ?, name = ?, email = ?, access_token = ?, expires_in = ?, refresh_token = ? WHERE user_id = ? ;";

var sqlSelectAllFromTable = "SELECT * FROM google;";

var sqlSelectFromTableByUserId = "SELECT * FROM google WHERE user_id = ?;";

var sqlDeleteFromTableOldEntries = "DELETE FROM google WHERE updated_date < ?";

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var refresh = require('passport-oauth2-refresh');

function google() {
  var moduleManager = {};
  var authClientId = undefined;
  var authClientSecret = undefined;
}

google.prototype.type = "AUTH";

google.prototype.name = "google";

google.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

google.prototype.load = function (moduleManager, config) {
  this.moduleManager = moduleManager;

  this.authClientId = (config && config.auth && config.auth.client_id || undefined);
  if (this.authClientId === undefined || this.authClientId === null || this.authClientId.trim() === '') {
    throw new Error('invalid configuration: no client id available');
  }

  this.authClientSecret = (config && config.auth && config.auth.client_secret || undefined);
  if (this.authClientSecret === undefined || this.authClientSecret === null || this.authClientSecret.trim() === '') {
    throw new Error('invalid configuration: no client secret available');
  }

  this.start();
};

google.prototype.unload = function () {
};

google.prototype.start = function() {
  var self = this;

  var web = this.moduleManager.findLoadedModuleByName('web');

  var strategy = new GoogleStrategy({
      clientID: this.authClientId,
      clientSecret: this.authClientSecret,
      scope: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar'],
      callbackURL: "http://localhost:8082/auth/google/callback"
    },
    function(accessToken, refreshToken, params, profile, done) {
      self.moduleManager.emit('database:auth:retrieveOne', sqlSelectFromTableByUserId, [profile.id],
        function(error, row) {
          if (error !== null) {
              logger.error(error.stack);
          } else {
            if (row === undefined) {
              self._addPresence(profile.id, profile.displayName, profile.emails[0].value, accessToken, params.expires_in, refreshToken);
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
};

google.prototype.stop = function () {
};

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
};

google.prototype.refreshAuth = function(accountId, callback) {
  var self = this;

  this.moduleManager.emit('database:auth:retrieveOne', sqlSelectFromTableByUserId, [accountId],
    function(error, row) {
      if (error !== null) {
          logger.error(error.stack);
      } else {
        if (row !== undefined) {
          refresh.requestNewAccessToken('google', row.refresh_token, function(error, accessToken) {
            if (error !== undefined && error !== null) {
                logger.error(error.stack);
            } else {
              row.access_token = accessToken;
              self._update(row.user_id, row.name, row.email, row.access_token, row.expires_in, row.refresh_token);

              callback(row);
            }
          });
        }
      }
    });
};

google.prototype._addPresence = function (userId, name, email, accessToken, expiresIn, refreshToken) {

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
          logger.error(error.stack);
      } else {

      }
    });
};

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
          logger.error(error.stack);
      } else {}
    });
};

module.exports = new google();
