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
          console.error(error);
        } else if (result !== undefined && result !== null) {

          try {
            callback(self._handleResult(result));
          } catch (error) {
            console.log(result);
            console.error(error);
          }
        }

      });
    }
  }
}

ask.prototype._handleResult = function(result) {
  var plaintext, image;
  //console.log(result);
  try {
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
        throw new Error();
      }

    } else if (result.queryresult.didyoumeans !== undefined && result.queryresult.didyoumeans !== null) {
      console.log(result.queryresult['$']);
      result.queryresult.didyoumeans[0].didyoumean.forEach(function(didyoumean) {});
      return 'I\'m not sure if I understand you correctly...';
    } else {
      console.log(result.queryresult['$']);
      return 'I\'m not sure if I understand you correctly...';
    }
  } catch (error) {
    console.error(error.stack);
    return 'I\'m not able to answer that question';
  }
}

ask.prototype._handleAnswer = function(datatypes, plaintext, image) {
  if (datatypes.indexOf('Math') > -1 ||
    datatypes.indexOf('Weather') > -1 ||
    datatypes.indexOf('HistoricalEvent')) {
    return this._handlePlaintext(plaintext);
  } else {
    return this._handlePlaintext(plaintext) + '\n' + this._handleImage(image);
  }
}

ask.prototype._handlePlaintext = function(plaintext) {
  if (plaintext !== undefined && plaintext !== null) {
    return plaintext[0];
  }
}

ask.prototype._handleImage = function(image) {
  if (image !== undefined && image !== null) {
    return image[0]['$'].src;
  }
}

module.exports = new ask();
