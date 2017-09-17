/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Listener = require('../utils/listener')

const _ = require('lodash')
const Promise = require('bluebird')

const Sequelize = require('sequelize')

const { mkdirAsync, existsSync } = Promise.promisifyAll(require('fs'))

const defaultOptions = {}

class Database extends Listener {
  constructor (options = {}) {
    super()

    this._options = _.defaultsDeep(options, defaultOptions)

    this._name = this._options.database.name

    this._sequelize = new Sequelize(null, null, null, {
      dialect: 'sqlite',
      pool: { max: 1, min: 0, idle: 10000 },
      storage: `${this._options.sequelize.pathDir}/${this._options.sequelize.filename}`,
      logging: false
    })
  }

  get name () {
    return this._name
  }

  get sequelize () {
    return this._sequelize
  }

  start (events = {}) {
    return Promise.resolve()
      .then(() => {
        if (!existsSync(this._options.sequelize.pathDir)) {
          return mkdirAsync(this._options.sequelize.pathDir)
        }
      })
      .then(() => this._sequelize.authenticate())
      .then(() => {
        return Promise.mapSeries(_.keys(this._models), (modelName) => this._models[ modelName ].sync())
      })
      .then(() => super.start(events))
  }

  stop () {
    return Promise.try(() => {
      if (this._sequelize) {
        return this._sequelize.connectionManager.close() // https://github.com/sequelize/sequelize/issues/4711
      }
    })
      .then(() => super.stop())
  }
}

module.exports = Database
