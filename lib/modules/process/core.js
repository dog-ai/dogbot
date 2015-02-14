/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function core() {
  var bot = {};
}

core.prototype.type = "PROCESS";

core.prototype.name = "core";

core.prototype.info = function() {
  return "*" + this.name + "* - _Core processing module_";
}

core.prototype.help = function() {
  var help = '';

  help += '*!help* - _Lists help information_'

  return help;
}

core.prototype.process = function(message, callback) {

  if (message === "!help") {
    var help = 'Available commands:\n';
    this.bot.modules.forEach(function(module) {
      try {
        if (module.type != 'PROCESS') {
          return;
        }

        help += module.help();
        help += '\n';
      } catch (exception) {}
    });

    help += '\nAvailable process modules:\n';
    this.bot.modules.forEach(function(module) {
      try {
        if (module.type != 'PROCESS') {
          return;
        }
        help += module.info();
        help += '\n';
      } catch (exception) {}
    });

    help += '\nAvailable schedule modules:\n';
    this.bot.modules.forEach(function(module) {
      try {
        if (module.type != 'SCHEDULE') {
          return;
        }
        help += module.info();
        help += '\n';
      } catch (exception) {}
    });

    help += '\nAvailable I/O modules:\n';
    this.bot.modules.forEach(function(module) {
      try {
        if (module.type != 'IO') {
          return;
        }
        help += module.info();
        help += '\n';
      } catch (exception) {}
    });

    callback(help);
  }
}

module.exports = new core();
