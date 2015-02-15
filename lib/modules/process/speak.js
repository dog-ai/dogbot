/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function speak() {
  var bot = {};
}

speak.prototype.type = "PROCESS";

speak.prototype.name = "speak";

speak.prototype.info = function() {
  return "*" + this.name + "* - _Speak processing module_";
}

speak.prototype.help = function() {
  var help = '';

  help += '*!speak <text>* - _Speak arbitary text_'

  return help;
}

speak.prototype.process = function(message, callback) {

  if (message.substring(0, "!speak".length) === "!speak") {
    var text = message.substring("!speak".length + 1, message.length);
    if (text !== undefined && text !== '') {
      this.bot.modules.forEach(function(module) {
        if (module.type === 'IO' && module.name === 'voice') {
          module.send(null, text);
        }
      });
    }
  }

}

module.exports = new speak();
