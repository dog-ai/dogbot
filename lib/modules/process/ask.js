/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var Client = require('node-wolfram');
var Wolfram = new Client('UH4P7Y-WAPYRK3898');

function ask() {
  var moduleManager = {};
}

ask.prototype.type = "PROCESS";

ask.prototype.name = "ask";

ask.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
}

ask.prototype.help = function() {
  var help = '';

  help += '*!ask* - _Ask a question and get its answer_'

  return help;
}

ask.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
}

ask.prototype.unload = function() {}

ask.prototype.process = function(message, callback) {

  if (message.substring(0, "!ask".length) === "!ask") {

    var question = message.substr(message.indexOf(' ') + 1);
    if (question !== undefined && question !== null && question.length > 0) {
      var self = this;

      Wolfram.query(question, function(error, result) {
        if (error !== undefined && error !== null) {
          console.error('Unable to process question because ' + error.message);
          callback("I'm unable to answer your question right now, get back to me later on");
        } else if (result !== undefined && result !== null) {

          try {
            var response = self._handleResult(result);
            callback(response);
          } catch (error) {
            console.error('Unable to process question because ' + error.message);
            callback("Oops! Something went wrong...please call the maintenance team!");
          }
        }

      });
    }
  }
}

ask.prototype._handleResult = function(result) {
  var plaintext, image;

  if (result.queryresult['$'].success === 'true') {
    result.queryresult.pod.forEach(function(pod) {
      if (pod['$'].primary === 'true') {

        pod.subpod.forEach(function(subpod) {
          plaintext = subpod.plaintext;
          image = subpod.img;
        });
      } else {}
    });

    if ((plaintext !== undefined && plaintext !== undefined) ||
      (image !== undefined && image !== null)) {
      return this._handleAnswer(result.queryresult['$'].datatypes, plaintext, image);
    } else {
    }

  } else if (result.queryresult.didyoumeans !== undefined && result.queryresult.didyoumeans !== null) {
    result.queryresult.didyoumeans[0].didyoumean.forEach(function(didyoumean) {
      console.log(didyoumean);
    });
    return 'Could you be more precise on what you want to know?';
  }

  return 'I\'m not sure if I follow you...';
}

ask.prototype._handleAnswer = function(datatypes, plaintext, image) {
  if (this._handlePlaintext(plaintext) !== undefined) {
    return this._handlePlaintext(plaintext);
  } else {
    return this._handleImage(image);
  }
}

ask.prototype._handlePlaintext = function(plaintext) {
  if (plaintext !== undefined && plaintext !== null && plaintext[0] !== '') {
    return plaintext[0];
  }
}

ask.prototype._handleImage = function(image) {
  if (image !== undefined && image !== null) {
    return image[0]['$'].src;
  }
}

module.exports = new ask();
