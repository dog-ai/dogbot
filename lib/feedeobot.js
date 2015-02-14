/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */


var CronJob = require('cron').CronJob;
var Path = require('path');

var feedeobot = {
  modules: [],
  revision: undefined,

  start: function(callback) {
    this._loadModules();

    this._loadRevision(function(exception, revision) {
      if (exception !== null) {
        throw exception;
      } else {
        this.revision = revision;
      }
    });

    callback();
  },

  stop: function(callback) {
    callback();
  },

  reload: function(callback) {
    var that = this;
    this._loadRevision(function(exception, revision) {
      if (exception !== null) {
      } else {
        if (revision != that.revision) {
          that.revision = revision;
          that.modules.forEach(function(module) {
            if (module.type === 'IO' && module.name === 'slack') {
              var channel = "D03LBFQ8T";
              var message = 'Refreshing my brains with code revision ' + that.revision;
              module.send(channel, message);
            }
          });
        }
      }
    });

    setTimeout(function() {
      callback();
    }, 500);
  },

  _loadModules: function() {
    if (this.modules === undefined) {
      this.modules = [];
    }
    var i = 0,
      that = this;

    var path = Path.join(__dirname, "modules/process");
    require("fs").readdirSync(path).forEach(function(file) {
      try {
        that.modules[i] = require("./modules/process/" + file);
        that.modules[i].bot = that;
        console.log("Loaded process module: " + that.modules[i].name);
        i++;
      } catch (exception) {
        console.log(exception);
        console.log('Unable to load process module: ' + file);
      }
    });

    path = Path.join(__dirname, "modules/schedule");
    require("fs").readdirSync(path).forEach(function(file) {
      var _module = that.modules[i] = require("./modules/schedule/" + file);
      that.modules[i].bot = that;
      var _that = that;
      try {
        new CronJob(that.modules[i].cron, function() {
          try {
            _module.schedule();
          } catch (exception) {
            console.log(exception);
            console.log('Unable to run schedule');
          }
        }, null, true, "Europe/Stockholm");
        console.log("Loaded schedule module: " + that.modules[i].name);
        i++;
      } catch (exception) {
        console.log(exception);
        console.log('Unable to load schedule module: ' + file);
      }
    });

    path = Path.join(__dirname, "modules/io");
    require("fs").readdirSync(path).forEach(function(file) {
      var _that = that;
      try {
        that.modules[i] = require("./modules/io/" + file);
        that.modules[i].on('message:received', function(message, callback) {
          _that.modules.forEach(function(module) {
            try {
              if (module.type == 'PROCESS') {
                module.process(message, callback);
              }
            } catch (exception) {
              callback("Oops! Something went wrong...please call the maintenance team!");
              console.log(exception);
            }
          });
        });
        console.log("Loaded I/O module: " + that.modules[i].name);
        i++;
      } catch (exception) {
        console.log(exception);
        console.log('Unable to load I/O module: ' + file);
      }
    });
  },

  _loadRevision: function(callback) {
    var revision = undefined;
    try {
      require('child_process')
        .exec('git rev-parse --short HEAD', {cwd: __dirname},
          function(error, stdout, stderr) {
            if (error != null) {
              throw error;
            } else {
              revision = stdout.slice(0, stdout.length - 1);
              console.log("Loaded code revision: " + revision);
              callback(null, revision);
            }
          });
    } catch (exception) {
      callback(exception, revision);
    }
  }
};

module.exports = feedeobot;
