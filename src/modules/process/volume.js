/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

function volume() {
  var moduleManager = {};
}

volume.prototype.type = "PROCESS";

volume.prototype.name = "volume";

volume.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

volume.prototype.help = function() {
  var help = '';

  help += '*!volume* [0-100%] - _Set loud speaker volume_';

  return help;
};

volume.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;

  if (process.platform !== 'linux') {
    throw new Error(process.platform + ' platform is not supported');
  }
};

volume.prototype.unload = function () {
};

volume.prototype.process = function(message, callback) {

  if (message.substring(0, "!volume".length) === "!volume") {
    var percentage = message.substring("!volume".length + 1, message.length);

    if (percentage !== undefined && percentage !== null && percentage.match(/^(100(\.0{1,2})?|[1-9]?\d(\.\d{1,2})?)%$/) !== null) {
      require('child_process')
        .exec('amixer -c 1 set Headphone ' + percentage,
          function(error, stdout, stderr) {
            if (error !== undefined && error !== null) {
                logger.error(error.message);
            }
          });
    } else {
      require('child_process')
        .exec("amixer -c 1 get Headphone | tail -n 1 | cut -d ' ' -f 7",
          function(error, stdout, stderr) {
            if (error !== undefined && error !== null) {
                logger.error(error.message);
            } else {
              callback(stdout.replace('[', '').replace(']', ''));
            }
          });
    }
  }
};

module.exports = new volume();
