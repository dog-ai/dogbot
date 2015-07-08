/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var wit = require('node-wit');
var fs = require('fs');

function listen() {
  var moduleManager = {};
  var accessToken = undefined;
}

listen.prototype.type = "PROCESS";

listen.prototype.name = "listen";

listen.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

listen.prototype.help = function() {
  var help = '';

  help += '*!listen* - _Listen for a question and get its answer_';

  return help;
};

listen.prototype.load = function (moduleManager, config) {
  this.moduleManager = moduleManager;

  this.accessToken = (config && config.auth && config.auth.access_token || undefined);
  if (this.accessToken === undefined || this.accessToken === null || this.accessToken.trim() === '') {
    throw new Error('invalid configuration: no authentication access token available');
  }
};

listen.prototype.unload = function () {
};

listen.prototype.process = function(message, callback) {

  if (message === "!listen") {
    this._listen(callback);
  }
};

listen.prototype._listen = function(callback) {
  var self = this;

  var sampleFile = __dirname + '/../../../tmp/' + Math.random() + '.wav';
  var sampleDuration = 7000;

  var voice = this.moduleManager.findLoadedModuleByName('voice');
  voice.send(null, "I'm listening", undefined, function() {

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
};

listen.prototype._sample = function(file, duration, callback) {
  var self = this;

  require('child_process')
    .exec('sox -t alsa hw:0,0 -b 16 -c 1 -r 16k ' + file + ' silence 0 1 3.0 0.5%', {
      timeout: duration
    }, function(error, stdout, stderr) {
      if (error !== undefined && error !== null && error.killed === true) {
        error = undefined;
      }
      callback(error);
    });
};

listen.prototype._upload = function(file, callback) {
  var self = this;

  var stream = fs.createReadStream(file);

  wit.captureSpeechIntent(this.accessToken, stream, "audio/wav", function (error, response) {

    if (error !== undefined && error !== null) {
      callback(error);
    } else {
      callback(null, response._text);
    }

  });
};

module.exports = new listen();
