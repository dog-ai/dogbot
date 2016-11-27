/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const Promise = require('bluebird')

const { retry } = require('../../utils')

const request = Promise.promisifyAll(require('request'))

const fetch = require('isomorphic-fetch')
const host = 'https://translate.google.com'
const url = require('url')

function tts (text, key, lang, speed) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('text should be a string')
  }

  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('key should be a string')
  }

  if (typeof lang !== 'undefined' && (typeof lang !== 'string' || lang.length === 0)) {
    throw new TypeError('lang should be a string')
  }

  if (typeof speed !== 'undefined' && typeof speed !== 'number') {
    throw new TypeError('speed should be a number')
  }

  const query = {
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

  return host + '/translate_tts' + url.format({ query })
}

function token (text, key) {
  function XL (a, b) {
    for (var c = 0; c < b.length - 2; c += 3) {
      var d = b.charAt(c + 2)
      d = d >= 'a' ? d.charCodeAt(0) - 87 : Number(d)
      d = b.charAt(c + 1) === '+' ? a >>> d : a << d
      a = b.charAt(c) === '+' ? a + d & 4294967295 : a ^ d
    }
    return a
  }

  var a = text
  var b = key
  var d = b.split('.')
  b = Number(d[ 0 ]) || 0
  for (var e = [], f = 0, g = 0; g < a.length; g++) {
    var m = a.charCodeAt(g)
    m < 128 ? e[ f++ ] = m : (m < 2048 ? e[ f++ ] = m >> 6 | 192 : ((m & 64512) === 55296 && g + 1 < a.length && (a.charCodeAt(g + 1) & 64512) === 56320 ? (m = 65536 + ((m & 1023) << 10) + (a.charCodeAt(++g) & 1023),
      e[ f++ ] = m >> 18 | 240,
      e[ f++ ] = m >> 12 & 63 | 128) : e[ f++ ] = m >> 12 | 224,
      e[ f++ ] = m >> 6 & 63 | 128),
      e[ f++ ] = m & 63 | 128)
  }
  a = b
  for (f = 0; f < e.length; f++) {
    a += e[ f ]
    a = XL(a, '+-a^+6')
  }
  a = XL(a, '+-3^+b+-f')
  a ^= Number(d[ 1 ]) || 0
  a < 0 && (a = (a & 2147483647) + 2147483648)
  a = a % 1E6
  return a.toString() + '.' + (a ^ b)
}

class Google extends Module {
  constructor () {
    super('tts', 'google')
  }

  start () {
    super.start({
      'tts:stream': this.stream.bind(this)
    })
  }

  stream ({ text, language = 'en' }, callback) {
    if (!text) {
      return callback(new Error())
    }

    this._getKey(10000)
      .then((key) => tts(text, key, 'en', 1))
      .then((url) => {
        if (!url) {
          return callback(new Error())
        }

        return retry(() => request(url), { max_tries: 3, interval: 500, timeout: 5000 })
      })
      .then((stream) => callback(null, stream))
      .catch(callback)
  }

  _getKey (timeout) {
    if (this._key) {
      return Promise.resolve(this._key)
    }

    return fetch(host, {
      timeout: timeout || 10 * 1000
    })
      .then((res) => {
        if (res.status !== 200) {
          throw new Error('request to ' + host + ' failed, status code = ' + res.status + ' (' + res.statusText + ')')
        }
        return res.text()
      })
      .then((html) => {
        var TKK = null

        try {
          // eslint-disable-next-line no-useless-escape,no-eval
          eval(html.match(/TKK=eval\(\'\(.*\)\'\);/g)[ 0 ])  // TKK = '405291.1334555331'
          if (TKK === null) {
            // eslint-disable-next-line no-throw-literal
            throw null
          }
        } catch (e) {
          throw new Error('get key failed from google')
        }

        this._key = TKK

        return TKK
      })
  }
}

module.exports = new Google()
