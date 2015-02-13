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
          try {
            help += module.help();
            help += '\n';
          } catch (exception) {
          }
        });
        help += '\nAvailable modules:\n';
        that.modules.forEach(function(module) {
          try {
            help += module.info();
            help += '\n';
          } catch (exception) {
          }
        });
        help += '\nAvailable crontabs:\n';
        that.crontabs.forEach(function(crontab) {
          try {
            help += crontab.info();
            help += '\n';
          } catch (exception) {
          }
        });
        channel.send(help);
      } else {
        that.modules.forEach(function(module) {
          try {
            module.process(type, channel, user, time, text, that.slack);
          } catch (exception) {
            channel.send("Oops! Something went wrong...please call the maintenance team!");
          }
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
      try {
        that.modules[i++] = require("./modules/" + file);
      } catch (exception) {
        console.log('Unable to load module file: ' + file);
      }
    });
  },

  _loadCrontabs: function() {
    var path = Path.join(__dirname, "crontabs"),
      i = 0,
      that = this;
    require("fs").readdirSync(path).forEach(function(file) {
      var crontab = that.crontabs[i] = require("./crontabs/" + file);
      var _that = that;
      try {
        new CronJob(crontab.time, function() {
          try {
            crontab.function(_that.modules, _that.slack);
          } catch (exception) {
            console.log('Unable to run crontab file');
          }
        }, null, true, "Europe/Stockholm");
        i++;
      } catch (exception) {
        console.log('Unable to load crontab file: ' + file);
      }
    });
  }
}

module.exports = feedeobot;
