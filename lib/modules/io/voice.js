/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

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

voice.prototype.send = function(recipient, message) {
    var texts = []
    if (message.length > this.MAX_LENGTH) {
        texts = this._split_text(message);
    } else {
        texts[0] = message;
    }

    var language = 'en';

    var idx = 0;
    var total = texts.length;
    var that = this;

    // need to make this recursive
    this._synthesize(language, texts[idx], total, idx, function() {
        var text = texts[++idx];
        if (text === undefined) {
            return;
        }
        that._synthesize(language, text, total, ++idx, function() {
            var text = texts[++idx];
            if (text === undefined) {
                return;
            }
            that._synthesize(language, text, total, ++idx);
        });
    });
}

voice.prototype._split_text = function(text) {
    var texts =   [];

    texts = text.match(/\(?[^\.\?\!]+[\.!\?]\)?/g);

    /*for (var p = i = 0; i < text.length; p++) {
        texts[p] = text.substr(i, this.MAX_LENGTH);
        if (texts[p].length == this.MAX_LENGTH) {
            texts[p] = texts[p].substr(0, Math.min(texts[p].length, texts[p].lastIndexOf(" ")))
            i++;
        } else if (texts[p].length == 0) {
            break;
        }
        i += texts[p].length;
    }*/
    return texts;
}

voice.prototype._synthesize = function(language, text, total, idx, callback) {
    //http://translate.google.com/translate_tts?ie=UTF-8&q=hello%20world&tl=en&total=1&idx=0&textlen=11&prev=input
    var url = 'http://translate.google.com/translate_tts?';
    url += querystring.stringify({
        ie: 'UTF-8',
        textlen: text.length,
        tl: language,
        total: total,
        idx: idx,
        q: text
    });


    try {
        require('child_process')
            .exec('mpg123 --no-gapless -q "' + url + '"',
                function(error, stdout, stderr) {
                    if (error != null) {
                        console.error(error);
                    } else {
                        if (callback !== undefined) {
                            callback();
                        }
                    }
                });
    } catch (exception) {

    }

/*var http = require('http');

var options = {
    host: 'rpi2.local',
    port: 36667,
    path: '/play',
    method: 'POST',
    headers: {
        'Content-Type': 'text/parameters',
        'Content-length': ('Content-Location: ' + url).length
    }
};

var request = http.request(options);
request.write('Content-Location: ' + url);
request.end();*/

};

module.exports = new voice();
