/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const DEFAULT_LOCALE = 'en'

const path = require('path')

const _ = require('lodash')

const i18n = require('i18n')

class Locale {
  constructor () {
    i18n.configure({
      directory: path.join(__dirname, '/../../locale'),
      autoReload: true,
      updateFiles: false
    })

    if (!_.includes(i18n.getLocales(), DEFAULT_LOCALE)) {
      throw new Error(`Default locale ${DEFAULT_LOCALE} not found`)
    }
  }

  get (locale, name, ...args) {
    if (!name) {
      name = locale
      locale = DEFAULT_LOCALE
    }

    if (!_.includes(i18n.getLocales(), locale)) {
      i18n.setLocale(DEFAULT_LOCALE)
    } else {
      i18n.setLocale(locale)
    }

    const message = i18n.__(name, ...args)

    return message instanceof Array ? message[ _.random(0, message.length) ] : message
  }
}

module.exports = new Locale()
