/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var revision = require('./revision.js');
var modules = require('./modules.js');

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
    var self = this;
    revision.hasRevisionChanged(function(error, changed, revision) {
      if (error !== undefined) {
        console.error(error);
      } else {
        if (changed) {
          console.log("Detected new code revision: " + revision);

          modules.findAllLoadedModulesByType('IO').forEach(function(module) {
            module.send("#feedeo", 'Refreshing my brains with code revision ' + revision);
          });
        }
      }

      self.stop(callback);
    });
  }
};

module.exports = feedeobot;
