/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var GoSquared = require('gosquared');
var nconf = require('nconf');

nconf.env().argv();
nconf.add('local', {type: 'file', file: __dirname + '/../../../conf/gosquared.json'});

var api = new GoSquared({
  api_key: nconf.get('auth:api_key'),
  site_token: nconf.get('auth:site_token')
});

function gosquared() {
  var bot = {};
}

gosquared.prototype.type = "PROCESS";

gosquared.prototype.name = "gosquared";

gosquared.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + "GoSquared" + " " +
    this.type.toLowerCase() + " module_";
}

gosquared.prototype.help = function() {
  var help = '';

  help += '*!who* - _List online users_'

  return help;
}

gosquared.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
}

gosquared.prototype.unload = function() {}

gosquared.prototype.process = function(message, callback) {
  if (message === "!who") {

    api.now.v3.visitors(function(e, data) {
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
}

module.exports = new gosquared();
