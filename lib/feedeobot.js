/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var CronJob = require('cron').CronJob;
var Path = require('path');
var modules = require('./modules.js');
var revision = require('./revision.js');

var feedeobot = {

  start: function(callback) {
    modules.loadAll();

    callback();
  },

  stop: function(callback) {
    modules.unloadAll();

    callback();
  },

  reload: function(callback) {
    revision.hasRevisionChanged(function(changed, revision) {
      if (changed) {
          console.log("Detected new code revision: " + revision);

          modules.findAllLoadedModulesByType('IO').forEach(function(module) {
              module.send("#feedeo", 'Refreshing my brains with code revision ' + revision);
          });
      }
    });

    this.stop(function() {
      setTimeout(function() {
        callback();
      }, 500);
    });
  }
};

module.exports = feedeobot;
