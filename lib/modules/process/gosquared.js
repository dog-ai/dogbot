/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var GoSquared = require('gosquared');

var api = new GoSquared({
  api_key: 'F6A6FO243DR5TG0J',
  site_token: 'GSN-547853-H'
});

function gosquared() {
  var bot = {};
}

gosquared.prototype.type = "PROCESS";

gosquared.prototype.name = "gosquared";

gosquared.prototype.info = function() {
  return "*" + this.name + "* - _GoSquared processing module_";
}

gosquared.prototype.help = function() {
  var help = '';

  help += '*!who* - _List online users_'

  return help;
}

gosquared.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

gosquared.prototype.unload = function() {
}

gosquared.prototype.process = function(message, callback) {
  if (message === "!who") {

    api.now.v3.visitors(function(e, data) {
      if (e) {
        return console.log(e);
      }

      var response = '';
      data.list.forEach(function(user) {
        response +=
          user.params.properties.name + '\t\t\t\t' +
          user.params.properties.company + '\t\t\t' +
          user.params.browserName + ' (' + user.params.browserVersion + ') \t\t' +
          user.params.landTime + '\t\t' +
          user.params.country;
        response += '\n';
      });

      response += data.list.length + ' user(s) online';

      callback(response);
    });
  }
}

module.exports = new gosquared();
