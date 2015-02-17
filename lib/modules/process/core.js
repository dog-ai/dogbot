/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function core() {
  var moduleManager = {};
}

core.prototype.type = "PROCESS";

core.prototype.name = "core";

core.prototype.info = function() {
  return "*" + this.name + "* - _Core processing module_";
}

core.prototype.help = function() {
  var help = '';

  help += '*!help* - _List help information_'

  return help;
}

core.prototype.process = function(message, callback) {

  if (message === "!help") {
    var help = 'Available commands:\n';
    this.moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function(module) {
      try {
        help += module.help() + '\n';
      } catch (exception) {
      }
    });

    help += '\nLoaded process modules:\n';
    this.moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function(module) {
      try {
        help += module.info() + '\n';
      } catch (exception) {
      }
    });

    help += '\nLoaded schedule modules:\n';
    this.moduleManager.findAllLoadedModulesByType('SCHEDULE').forEach(function(module) {
      try {
        help += module.info() + '\n';
      } catch (exception) {
      }
    });

    help += '\nLoaded I/O modules:\n';
    this.moduleManager.findAllLoadedModulesByType('IO').forEach(function(module) {
      try {
        help += module.info() + '\n';
      } catch (exception) {
      }
    });

    help += '\nLoaded monitor modules:\n';
    this.moduleManager.findAllLoadedModulesByType('MONITOR').forEach(function(module) {
      try {
        help += module.info() + '\n';
      } catch (exception) {
      }
    });

    callback(help);
  }
}

module.exports = new core();
