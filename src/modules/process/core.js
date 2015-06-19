/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function core() {
  var moduleManager = {};
}

core.prototype.type = "PROCESS";

core.prototype.name = "core";

core.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

core.prototype.help = function() {
  var help = '';

  help += '*!help* - _List help information_' + '\n';
  help += '*!info* - _Hardware/OS/Network related information_'

  return help;
}

core.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

core.prototype.unload = function() {
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

    help += '\nLoaded auth modules:\n';
    this.moduleManager.findAllLoadedModulesByType('AUTH').forEach(function(module) {
      try {
        help += module.info() + '\n';
      } catch (exception) {
      }
    });

    callback(help);
  } else if (message === "!info") {
    var os = require('os');

    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    var response = 'Network addresses: ' + addresses;
    callback(response);
  }
}

module.exports = new core();
