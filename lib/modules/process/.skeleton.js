/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function skeleton() {
  var moduleManager = {};
}

skeleton.prototype.type = "PROCESS";

skeleton.prototype.name = "skeleton";

skeleton.prototype.info = function() {
    return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

skeleton.prototype.help = function() {
  var help = '';

  help += '*!skeleton* - _Skeleton command information_'

  return help;
}

skeleton.prototype.process = function(message, callback) {

  if (message === "!skeleton") {
  }
}

module.exports = new skeleton();
