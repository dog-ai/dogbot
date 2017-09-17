/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('modern-logger')

const Server = require('../../server')

const Databases = require('../../databases')

class MonitorModule extends Module {
  constructor (name) {
    super('monitor', name)
  }

  discover (command, where, date) {
    if (!_.isFunction(command) || !_.isArray(where) || !_.isDate(date)) {
      return Promise.reject(new Error('invalid arguments'))
    }

    return command()
      .mapSeries((data) => {
        return Databases[ _.capitalize(this.type) ][ this.name ].find({ where: _.pick(data, where) })
          .then((row) => {
            if (!row) {
              return Databases[ _.capitalize(this.type) ][ this.name ].create(data)
                .then(() => Server.emit(`${this.type}:${this.name}:create`, data))
            }

            return row.save()
              .then(() => Server.emit(`${this.type}:${this.name}:update`, row.get({ plain: true })))
          })
          .catch((error) => Logger.warn(error))
      })
      .then(() => this.clean(date))
  }

  clean (date) {
    if (!_.isDate(date)) {
      return Promise.reject(new Error('invalid arguments'))
    }

    return Databases[ _.capitalize(this.type) ][ this.name ].findAll({ where: { updated_date: { $lte: date } } })
      .mapSeries((row) => {
        return row.destroy()
          .then(() => Server.emit(`${this.type}:${this.name}:delete`, row.get({ plain: true })))
      })
  }
}

module.exports = MonitorModule
