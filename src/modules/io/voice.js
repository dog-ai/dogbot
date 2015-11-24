/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

var child_process = require('child_process');
var events = require('events');
var querystring = require('querystring');

function voice() {
    events.EventEmitter.call(this);
}

voice.prototype.__proto__ = events.EventEmitter.prototype;

voice.prototype.type = "IO";

voice.prototype.name = "voice";

voice.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " I/O module_";
};

voice.prototype.MAX_LENGTH = 100;

voice.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
};

voice.prototype.unload = function () {
};

voice.prototype.send = function(recipient, message, language, callback) {
    if (language === undefined) {
        language = 'en-us';
    }

    var texts = [];
    if (message.length > this.MAX_LENGTH) {
        texts = this._split_text(message);
    } else {
        texts[0] = message;
    }

    this._synthesize(texts, language, function() {
        if (callback !== undefined) {
            callback();
        }
    });
};

voice.prototype._split_text = function(text) {
    var texts =   [];

    for (var p = i = 0; i < text.length; p++) {
        texts[p] = text.substr(i, this.MAX_LENGTH);
        if (texts[p].length == this.MAX_LENGTH) {
            texts[p] = texts[p].substr(0, Math.min(texts[p].length, texts[p].lastIndexOf(" ")));
            i++;
        } else if (texts[p].length == 0) {
            break;
        }
        i += texts[p].length;
    }

    return texts;
};

voice.prototype._synthesize = function(texts, language, callback) {
    var self = this;

    var urls = [];
    for (var i = 0; i < texts.length; i++) {
        //http://translate.google.com/translate_tts?ie=UTF-8&q=hello%20world&tl=en&total=1&idx=0&textlen=11&prev=input
        urls[i] = 'http://translate.google.com/translate_tts?';
        urls[i] += querystring.stringify({
            ie: 'UTF-8',
            textlen: texts[i].length,
            tl: language,
            total: texts.length,
            idx: i,
            q: texts[i]
        });
    }

    this._play(urls, 0, texts.length, callback);
};

voice.prototype._play = function(urls, current, total, callback) {
    var self = this;

    try {
        child_process.exec('curl --silent -A "Mozilla" "' + urls[current] + '" | play -q -t mp3 -',
            function(error, stdout, stderr) {
                if (error !== undefined && error !== null) {} else {
                    current++;
                    if (current < total) {
                        self._play(urls, current, total, callback);
                    } else {
                        callback();
                    }
                }
            });
    } catch (error) {
        logger.error(error.stack);
    }
};

module.exports = new voice();
