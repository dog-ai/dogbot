/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var stackTrace = require('stack-trace');

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
          console.log('Detected new code revision: ' + revision);

          modules.findAllLoadedModulesByType('IO').forEach(function(module) {
            module.send(null, 'Refreshing my brains with code revision ' + revision);
          });
        }
      }

      self.stop(callback);
    });
  },

  error: function(error) {
    var traces = stackTrace.parse(error);

    console.log(error.stack);

    if (traces !== undefined && traces !== null) {
      traces.forEach(function(trace) {
        var filename = trace.getFileName();
        var name = filename.substring(filename.lastIndexOf("/") + 1, filename.lastIndexOf("."));
        var module = modules.findLoadedModuleByName(name);
        if (module !== undefined && module !== null) {
          modules.unloadModule(module);
        }
      });
    }
  }
};

module.exports = feedeobot;
