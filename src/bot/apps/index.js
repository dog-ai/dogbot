/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('../../utils/logger.js')

const Databases = require('../../databases')
const Modules = require('../../modules')

const path = require('path')
const fs = require('fs')

class Apps {
  constructor () {
    this.appsDir = path.join(__dirname, '/')

    this.enabled = []
    this.available = (fs.readdirSync(this.appsDir) || [])
      .filter(file => file.indexOf('index') === -1)
      .map(file => file.replace('.js', ''))
  }

  enableApp (id, config) {
    if (_.find(this.enabled, { id: id }) || !_.contains(this.available, id)) {
      // reload
      return this.disableApp(id)
        .then(() => this.enableApp(id, config))
    }

    const app = require(this.appsDir + id)
    let promises = []

    _.forEach(app.databases, (database) => {
      promises.push(Databases.startDatabase(database.type, database.name))
    })

    return Promise.all(promises)
      .then(function () {
        promises = []

        _.forEach(app.modules, (module) => {
          promises.push(Modules.loadModule(module.type, module.name, module.optional, config))
        })

        return Promise.all(promises)
      })
      .then(() => {
        this.enabled.push(app)

        Logger.info('Enabled app: ' + app.id)
      })
      .catch((error) => {
        promises = []

        _.forEach(app.databases, (database) => {
          promises.push(Databases.stopDatabase(database.type, database.name))
        })

        _.forEach(app.modules, (module) => {
          promises.push(Modules.unloadModule(module.name))
        })

        Logger.error('Unable to enable app ' + id + ' because ' + error.message)

        return Promise.all(promises)
      })
  }

  disableApp (id) {
    const app = _.find(this.enabled, { id: id })

    if (!app) {
      return
    }

    let promises = []

    _.forEach(app.modules, (module) => {
      promises.push(Modules.unloadModule(module.name))
    })

    return Promise.all(promises)
      .then(() => {
        promises = []

        _.forEach(app.databases, (database) => {
          promises.push(Databases.stopDatabase(database.type, database.name))
        })

        return Promise.all(promises)
      })
      .then(() => {
        _.remove(this.enabled, { id: id })

        Logger.info('Disabled app: ' + id)

      })
      .catch((error) => {
        Logger.info('Unable to disable app ' + id + ' because ' + error.message)
      })
  }

  disableAllApps () {
    const promises = []

    _.forEach(this.enabled, (app) => {
      promises.push(this.disableApp(app.id))
    })

    return Promise.all(promises)
  }

  healthCheck () {
    return Promise.resolve()
  }
}

module.exports = new Apps()

