/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

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
    return "*" + this.name + "* - _Voice I/O module_";
}

voice.prototype.MAX_LENGTH = 100;

voice.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

voice.prototype.unload = function() {
}

voice.prototype.send = function(recipient, message, callback) {
    var texts = []
    if (message.length > this.MAX_LENGTH) {
        texts = this._split_text(message);
    } else {
        texts[0] = message;
    }

    this._synthesize(texts, function() {
        if (callback !== undefined) {
           callback();
        }
    });
}

voice.prototype._split_text = function(text) {
    var texts =   [];

    for (var p = i = 0; i < text.length; p++) {
        texts[p] = text.substr(i, this.MAX_LENGTH);
        if (texts[p].length == this.MAX_LENGTH) {
            texts[p] = texts[p].substr(0, Math.min(texts[p].length, texts[p].lastIndexOf(" ")))
            i++;
        } else if (texts[p].length == 0) {
            break;
        }
        i += texts[p].length;
    }

    return texts;
}

voice.prototype._synthesize = function(texts, callback) {
    var self = this;
    var idx = 0;
    var total = texts.length;

    texts.forEach(function(text){
        //http://translate.google.com/translate_tts?ie=UTF-8&q=hello%20world&tl=en&total=1&idx=0&textlen=11&prev=input
        var url = 'http://translate.google.com/translate_tts?';
        url += querystring.stringify({
            ie: 'UTF-8',
            textlen: text.length,
            tl: 'en-us',
            total: total,
            idx: idx,
            q: text
        });

        self._play(url);

        idx++;
    });

    callback();
};

voice.prototype._play = function(url) {
    try {
        // should use exec to avoid slack timeouts on longer text messages
        child_process.execSync('curl --silent -A "Mozilla" "' + url + '" | play -q -t mp3 -');
    } catch (error) {
        console.error(error);
    }
}

module.exports = new voice();
