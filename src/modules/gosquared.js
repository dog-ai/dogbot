var GoSquared = require('gosquared');

var client = new GoSquared({
  api_key: 'F6A6FO243DR5TG0J',
  site_token: 'GSN-547853-H'
});

function gosquared() {}

gosquared.prototype.process = function(type, channel, user, time, text, callback) {
  if (text === "!who") {

    client.now.v3.visitors(function(e, data) {
      if (e) {
        return console.log(e);
      }

      var response = '';
      data.list.forEach(function(user) {
        response +=
          user.params.properties.name + '\t' +
          user.params.properties.company + '\t' +
          user.params.browserName + '/' + user.params.browserVersion + '\t' +
          user.params.landTime + '\t' +
          user.params.country;
        response += '\n';
      });

      response += data.list.length + ' user(s) online';

      callback(response);
    });
  }
}

module.exports = new gosquared();
