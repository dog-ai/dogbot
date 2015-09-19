/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var GoSquared = require('gosquared');

function gosquared() {
  var bot = {};
  var api = undefined;
}

gosquared.prototype.type = "PROCESS";

gosquared.prototype.name = "gosquared";

gosquared.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + "GoSquared" + " " +
    this.type.toLowerCase() + " module_";
};

gosquared.prototype.help = function() {
  var help = '';

  help += '*!who* - _List online users_';

  return help;
};

gosquared.prototype.load = function (moduleManager, config) {
  this.moduleManager = moduleManager;

  var apiKey = (config && config.auth && config.auth.api_key || undefined);
  if (apiKey === undefined || apiKey === null || apiKey.trim() === '') {
    throw new Error('invalid configuration: no authentication API key available');
  }

  var siteToken = (config && config.auth && config.auth.site_token || undefined);
  if (siteToken === undefined || siteToken === null || siteToken.trim() === '') {
    throw new Error('invalid configuration: no authentication site token available');
  }

  this.api = new GoSquared({
    api_key: apiKey,
    site_token: siteToken
  });
};

gosquared.prototype.unload = function () {
};

gosquared.prototype.process = function(message, callback) {
  if (message === "!who") {

    this.api.now.v3.visitors(function (e, data) {
      if (e) {
        return console.log(e);
      }

      var response = '';
      data.list.forEach(function(user) {
        if (user.params !== undefined && user.params !== null) {
          var browserName = user.params.browserName;
          var browserVersion = user.params.browserVersion;
          var landTime = user.params.landTime;
          var country = user.params.country;

          var name, company;
          if (user.params.properties !== undefined && user.params !== null) {
            name = user.params.properties.name;
            company = user.params.properties.company;
          } else {
            company = name = 'Unknown';
          }

          response +=
            name + '\t\t\t\t' +
            company + '\t\t\t' +
            browserName + ' (' + browserVersion + ') \t\t' +
            landTime + '\t\t' +
            country;
          response += '\n';
        }
      });

      response += data.list.length + ' user(s) online';

      callback(response);
    });
  }
};

module.exports = new gosquared();
