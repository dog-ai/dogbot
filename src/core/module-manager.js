/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('modern-logger')

const path = require('path')
const fs = require('fs')

class Modules {
  constructor () {
    this.modulesDir = path.join(__dirname, '/../modules/')

    this.loaded = []
    this.available = []
    this.types = (fs.readdirSync(this.modulesDir) || []).map(type => type.toUpperCase())
  }

  loadModule (type, name, optional, config, reload) {
    reload = reload || false

    const module = _.find(this.loaded, { name: name })

    if (module) {
      if (!reload) {
        return
      }

      return this._unload(module)
        .then(() => this._load(type, name, optional, config))
    } else {
      return this._load(type, name, optional, config)
    }
  }

  unloadModule (name) {
    const module = _.find(this.loaded, { name: name })

    if (!module) {
      return
    }

    this._unload(module)
  }

  _load (type, name, optional, config) {
    return new Promise((resolve, reject) => {
      if (config && !config.is_enabled) {
        return
      }

      // TODO: need to rewrite with promises instead
      _.defer(() => {
        try {
          var module
          try {
            module = require(this.modulesDir + type.toLowerCase() + '/' + name + '.js')
          } catch (error) {
            module = require(this.modulesDir + type.toLowerCase() + '/' + name)
          }

          module.load(config)

          this.loaded.push(module)

          Logger.debug('Loaded ' + type.toLowerCase() + ' module: ' + module.name)

          resolve()
        } catch (error) {
          if (!(error.message.indexOf('platform is not supported') > -1 ||
            error.message.indexOf('invalid configuration') > -1 ||
            error.message.indexOf('unix socket not available') > -1)) {
            Logger.error(error)
          }

          if (optional) {
            Logger.debug('Unable to load optional ' + type.toLowerCase() + ' module ' + name + ' because ' + error.message)

            resolve()
          } else {
            reject(new Error('unable to load ' + type.toLowerCase() + ' module ' + name))
          }
        }
      })
    })
  }

  _unload (module) {
    return new Promise((resolve, reject) => {
      try {
        module.unload()

        try {
          delete require.cache[ require.resolve(this.modulesDir + module.type.toLowerCase() + '/' + module.name + '.js') ]
        } catch (error) {
          delete require.cache[ require.resolve(this.modulesDir + module.type.toLowerCase() + '/' + module.name) ]
        }

        _.remove(this.loaded, (_module) => _module.name === module.name)

        Logger.debug('Unloaded ' + module.type.toLowerCase() + ' module: ' + module.name)

        resolve()
      } catch (error) {
        Logger.debug('Unable to unload ' + module.type.toLowerCase() + ' module ' + module.name + ' because ' + error.message)

        reject(new Error('unable to unload ' + module.type.toLowerCase() + ' module ' + module.name))
      }
    })
  }
}

module.exports = new Modules()
