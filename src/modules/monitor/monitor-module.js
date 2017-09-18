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

  discover (data, where, date) {
    return this.createOrUpdate(data, where)
      .then(() => this.deleteOlder(date))
  }

  createOrUpdate (data, where) {
    if (!_.isArray(data) || !_.isArray(where)) {
      return Promise.reject(new Error('invalid arguments'))
    }

    return Promise.mapSeries(data, (data) => {
      return Databases[ _.capitalize(this.type) ][ this.name ].findOne({ where: _.pick(data, where) })
        .then((row) => {
          if (!row) {
            return Databases[ _.capitalize(this.type) ][ this.name ].create(data)
              .then(() => Server.emit(`${this.type}:${this.name}:create`, data))
          }

          row.changed('updated_date', true)

          return row.save()
            .then(() => Server.emit(`${this.type}:${this.name}:update`, row.get({ plain: true })))
        })
        .catch((error) => Logger.warn(error))
    })
  }

  deleteOlder (date) {
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
