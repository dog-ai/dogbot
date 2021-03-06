/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const APP_BLACKLIST = process.env.DOGBOT_APP_BLACKLIST

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('modern-logger')

const { AppNotAvailableError, AppAlreadyDisabledError } = require('./errors')

const Databases = require('./database-manager')
const Modules = require('./module-manager')

const path = require('path')
const fs = require('fs')

const APP_DIR = path.join(__dirname, '/../../share/apps')

class AppManager {
  constructor () {
    this.blacklist = (APP_BLACKLIST && APP_BLACKLIST.split(' ')) || []

    this.enabled = []

    this.available = (fs.readdirSync(APP_DIR) || [])
      .map(file => file.replace('.json', ''))
      .filter(file => file !== 'app-manager' && file !== 'errors' && file !== 'app')
      .filter(file => !_.includes(this.blacklist, file))
  }

  enableApp (id, config) {
    if (_.find(this.enabled, { id: id })) {
      // reload
      return this.disableApp(id)
        .then(() => this.enableApp(id, config))
    }

    if (!_.includes(this.available, id)) {
      return Promise.reject(new AppNotAvailableError())
    }

    const app = require(`${APP_DIR}/${id}.json`)
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

        Logger.error(new Error('Unable to enable app ' + id + ' because ' + error.message))

        return Promise.all(promises)
      })
  }

  disableApp (id) {
    const app = _.find(this.enabled, { id: id })

    if (!app) {
      return Promise.reject(new AppAlreadyDisabledError())
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

module.exports = AppManager
