/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function speak() {
  var moduleManager = {};
}

speak.prototype.type = "PROCESS";

speak.prototype.name = "speak";

speak.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

speak.prototype.help = function() {
  var help = '';

  help += '*!speak <text>* - _Speak arbitary text_'

  return help;
}

speak.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

speak.prototype.unload = function() {
}

speak.prototype.process = function(message, callback) {

  if (message.substring(0, "!speak".length) === "!speak") {
    var text = message.substring("!speak".length + 1, message.length);
    if (text !== undefined && text !== '') {
      this.moduleManager.findLoadedModuleByName('voice').send(null, text);
    }
  }

}

module.exports = new speak();
