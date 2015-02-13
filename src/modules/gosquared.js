/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var GoSquared = require('gosquared');

var client = new GoSquared({
  api_key: 'F6A6FO243DR5TG0J',
  site_token: 'GSN-547853-H'
});

function gosquared() {}

gosquared.prototype.help = function() {
  var help = '';

  help += '*!who*\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t(List Feedeo online users)'

  return help;
}

gosquared.prototype.process = function(type, channel, user, time, text, callback) {
  if (text === "!who") {

    client.now.v3.visitors(function(e, data) {
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
