var Slack = require('slack-client');

var feedeobot = {
  modules: [],
  client: undefined,

  start: function(callback) {
    this._loadModules();

    var token = 'xoxb-3691534247-A6d2bMOL1WSf8iu7OeGxDH9y',
      autoReconnect = true,
      autoMark = true;
    client = new Slack(token, autoReconnect, autoMark);

    client.on('open', function() {});

    var that = this;
    client.on('message', function(message) {
      var type = message.type,
        channel = client.getChannelGroupOrDMByID(message.channel),
        user = client.getUserByID(message.user),
        time = message.ts,
        text = message.text;

      that.modules.forEach(function(module) {
        module.process(type, channel, user, time, text, function(response) {
          if (response != '') {
            channel.send(response);
          }
        });
      });
    });

    client.on('error', function(error) {
      console.error('Error: %s', error);
    });

    client.login();

    callback();
  },

  stop: function(callback) {
    client.stop();

    callback();
  },

  _loadModules: function() {
    var path = require("path").join(__dirname, "modules"),
      i = 0,
      that = this;
    require("fs").readdirSync(path).forEach(function(module) {
      that.modules[i++] = require("./modules/" + module);
    });
  }
}

module.exports = feedeobot;
