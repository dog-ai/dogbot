/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
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
};

speak.prototype.help = function() {
  var help = '';

  help += '*!speak <text>* - _Speak arbitrary text in english_\n';
  help += '*!prata <text>* - _Speak arbitrary text in swedish_\n';
  help += '*!fala <text>* - _Speak arbitrary text in portuguese_\n';
  help += '*!habla <text>* - _Speak arbitrary text in spanish_\n';
  help += '*!parle <text>* - _Speak arbitrary text french_\n';
  help += '*!sprich <text>* - _Speak arbitrary text german_\n';
  help += '*!puhua <text>* - _Speak arbitrary text finnish_\n';

  return help;
};

speak.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
};

speak.prototype.unload = function () {
};

speak.prototype.process = function(message, callback) {

  if (message.substring(0, "!speak".length) === "!speak") {
    var text = message.substring("!speak".length + 1, message.length);
    this._speak(text, 'en-us');
  } else if (message.substring(0, "!prata".length) === "!prata") {
    var text = message.substring("!prata".length + 1, message.length);
    this._speak(text, 'sv');
  } else if (message.substring(0, "!fala".length) === "!fala") {
    var text = message.substring("!fala".length + 1, message.length);
    this._speak(text, 'pt');
  } else if (message.substring(0, "!habla".length) === "!habla") {
    var text = message.substring("!habla".length + 1, message.length);
    this._speak(text, 'es');
  } else if (message.substring(0, "!parle".length) === "!parle") {
    var text = message.substring("!parle".length + 1, message.length);
    this._speak(text, 'fr');
  } else if (message.substring(0, "!sprich".length) === "!sprich") {
    var text = message.substring("!sprich".length + 1, message.length);
    this._speak(text, 'de');
  } else if (message.substring(0, "!puhua".length) === "!puhua") {
    var text = message.substring("!puhua".length + 1, message.length);
    this._speak(text, 'fi');
  }

};

speak.prototype._speak = function(text, language, callback) {
  if (text !== undefined && text !== '') {
    this.moduleManager.findLoadedModuleByName('voice').send(null, text, language);
  }
};

module.exports = new speak();
