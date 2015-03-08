/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var wit = require('node-wit');
var ACCESS_TOKEN = 'KBY5S6H2KCNYB2PEEAK6PJMMVRW3ENPE';
var fs = require('fs');

function listen() {
  var moduleManager = {};
}

listen.prototype.type = "PROCESS";

listen.prototype.name = "listen";

listen.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

listen.prototype.help = function() {
  var help = '';

  help += '*!listen* - _listen command information_'

  return help;
}

listen.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
}

listen.prototype.unload = function() {}

listen.prototype.process = function(message, callback) {

  if (message === "!listen") {
    this._listen(callback);
  }
}

listen.prototype._listen = function(callback) {
  var self = this;

  var sampleFile = __dirname + '/../../../tmp/' + Math.random() + '.wav';
  var sampleDuration = 5000;

  var voice = this.moduleManager.findLoadedModuleByName('voice');
  voice.send(null, "I'm listening", function() {

    self._sample(sampleFile, sampleDuration, function(error) {
      if (error !== undefined && error !== null) {
        console.error(error);
        fs.unlink(sampleFile);
      } else {
        voice.send(null, 'Let me think...');

        self._upload(sampleFile, function(error, text) {
          if (error !== undefined && error !== null) {
            console.error(error);
          } else {
            callback('I heard "' + text + '"');

            var ask = self.moduleManager.findLoadedModuleByName('ask');
            ask.process('!ask ' + text, function(result) {
              callback(result);
              voice.send(null, result);
            });
          }
          fs.unlink(sampleFile);
        });
      }
    });

  });
}

listen.prototype._sample = function(file, duration, callback) {
  var self = this;

  require('child_process')
    .exec('sox -d -b 16 -c 1 -r 16k ' + file, {
      'timeout': duration
    }, function(error, stdout, stderr) {
      callback(error);
    });
}

listen.prototype._upload = function(file, callback) {
  var self = this;

  var stream = fs.createReadStream(file);

  wit.captureSpeechIntent(ACCESS_TOKEN, stream, "audio/wav", function(error, response) {

    if (error !== undefined && error !== null) {
      callback(error);
    } else {
      callback(null, response._text);
    }

  });
}

module.exports = new listen();
