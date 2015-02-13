/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var Slack = require('slack-client');
var CronJob = require('cron').CronJob;
var Path = require('path');

var feedeobot = {
  modules: [],
  crontabs: [],
  slack: undefined,

  start: function(callback) {
    this._loadModules();

    var token = 'xoxb-3691534247-A6d2bMOL1WSf8iu7OeGxDH9y',
      autoReconnect = true,
      autoMark = true;
    this.slack = new Slack(token, autoReconnect, autoMark);

    this.slack.on('open', function() {});

    var that = this;
    this.slack.on('message', function(message) {
      var type = message.type,
        channel = that.slack.getChannelGroupOrDMByID(message.channel),
        user = that.slack.getUserByID(message.user),
        time = message.ts,
        text = message.text;

      if (text === '!help') {
        var help = 'Available commands:\n';
        that.modules.forEach(function(module) {
          help += module.help();
          help += '\n';
        });
        help += '\nAvailable modules:\n';
        that.modules.forEach(function(module) {
          help += module.info();
          help += '\n';
        });
        help += '\nAvailable crontabs:\n';
        that.crontabs.forEach(function(crontab) {
          help += crontab.info();
          help += '\n';
        });
        channel.send(help);
      } else {
        that.modules.forEach(function(module) {
          module.process(type, channel, user, time, text, function(text) {
            if (text != '') {
              channel.send(text);
            }
          });
        });
      }

    });

    this.slack.on('error', function(error) {
      console.error('Error: %s', error);
    });

    this.slack.login();

    this._loadCrontabs();

    callback();
  },

  stop: function(callback) {

    callback();
  },

  _loadModules: function() {
    var path = Path.join(__dirname, "modules"),
      i = 0,
      that = this;
    require("fs").readdirSync(path).forEach(function(file) {
      that.modules[i++] = require("./modules/" + file);
    });
  },

  _loadCrontabs: function() {
    var path = Path.join(__dirname, "crontabs"),
      i = 0,
      that = this;
    require("fs").readdirSync(path).forEach(function(file) {
      var crontab = that.crontabs[i] = require("./crontabs/" + file);
      var _that = that;
      new CronJob(crontab.time, function() {crontab.function(_that.modules, _that.slack);}, null, true, "Europe/Stockholm");
      i++;
    });
  }
}

module.exports = feedeobot;
