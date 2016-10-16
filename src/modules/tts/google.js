/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const Promise = require('bluebird')
const retry = require('bluebird-retry')

const request = Promise.promisifyAll(require('request'))

const fetch = require('isomorphic-fetch')
const url = require('url')
const host = 'https://translate.google.com'
const client = require('google-tts-api')

function key (timeout) {
  return fetch(host, {
    timeout: timeout || 10 * 1000
  })
    .then(function (res) {
      if (res.status !== 200) {
        throw new Error('request to ' + host + ' failed, status code = ' + res.status + ' (' + res.statusText + ')');
      }
      return res.text();
    })
    .then(function (html) {
      var TKK = null;

      try {
        eval(html.match(/TKK=eval\(\'\(.*\)\'\);/g)[ 0 ]);  // TKK = '405291.1334555331'
        if (TKK === null) throw null;
      } catch (e) {
        throw new Error('get key failed from google');
      }

      return TKK;
    });
}

function XL (a, b) {
  for (var c = 0; c < b.length - 2; c += 3) {
    var d = b.charAt(c + 2);
    d = d >= 'a' ? d.charCodeAt(0) - 87 : Number(d);
    d = b.charAt(c + 1) === '+' ? a >>> d : a << d;
    a = b.charAt(c) === '+' ? a + d & 4294967295 : a ^ d;
  }
  return a;
}

function token (text, key) {
  var a = text, b = key, d = b.split('.');
  b = Number(d[ 0 ]) || 0;
  for (var e = [], f = 0, g = 0; g < a.length; g++) {
    var m = a.charCodeAt(g);
    128 > m ? e[ f++ ] = m : (2048 > m ? e[ f++ ] = m >> 6 | 192 : (55296 == (m & 64512) && g + 1 < a.length && 56320 == (a.charCodeAt(g + 1) & 64512) ? (m = 65536 + ((m & 1023) << 10) + (a.charCodeAt(++g) & 1023),
      e[ f++ ] = m >> 18 | 240,
      e[ f++ ] = m >> 12 & 63 | 128) : e[ f++ ] = m >> 12 | 224,
      e[ f++ ] = m >> 6 & 63 | 128),
      e[ f++ ] = m & 63 | 128);
  }
  a = b;
  for (f = 0; f < e.length; f++) {
    a += e[ f ];
    a = XL(a, '+-a^+6');
  }
  a = XL(a, '+-3^+b+-f');
  a ^= Number(d[ 1 ]) || 0;
  0 > a && (a = (a & 2147483647) + 2147483648);
  a = a % 1E6;
  return a.toString() + '.' + (a ^ b);
}

function tts (text, key, lang, speed) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('text should be a string');
  }

  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('key should be a string');
  }

  if (typeof lang !== 'undefined' && (typeof lang !== 'string' || lang.length === 0)) {
    throw new TypeError('lang should be a string');
  }

  if (typeof speed !== 'undefined' && typeof speed !== 'number') {
    throw new TypeError('speed should be a number');
  }

  return host + '/translate_tts' + url.format({
      query: {
        ie: 'UTF-8',
        q: text,
        tl: lang || 'en',
        total: 1,
        idx: 0,
        textlen: text.length,
        tk: token(text, key),
        client: 't',
        prev: 'input',
        ttsspeed: speed || 1
      }
    });
}
class Google extends Module {
  constructor () {
    super('tts', 'google')
  }

  start () {
    super.start({
      'tts:stream': this._stream.bind(this)
    })
  }

  _stream ({ text, language = 'en', speed = 1 }, callback) {
    if (!text) {
      return callback(new Error())
    }

    key(10000)
      .then((key) => tts(text, key, language, speed))
      .then((url) => this._download(url))
      .then((stream) => callback(null, stream))
      .catch(callback)
  }

  _download (url) {
    if (!url) {
      return Promise.reject(new Error())
    }

    const options = { url }

    return retry(() => request.getAsync(options), {
      max_tries: 3,
      interval: 500,
      timeout: 5000
    })
  }
}

module.exports = new Google()
