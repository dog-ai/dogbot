/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const _ = require('lodash')
const Promise = require('bluebird')

const Logger = require('modern-logger')

const path = require('path')
const fs = require('fs')

class Databases {
  constructor () {
    this.databasesDir = path.join(__dirname, '/../databases/')

    this.started = []
    this.types = (fs.readdirSync(this.databasesDir) || []).filter((type) => {
      return type.indexOf('.') <= -1
    }).map((type) => {
      return type.toUpperCase()
    })
  }

  startDatabase (type, name) {
    if (_.find(this.started, { type: type, name: name })) {
      return
    }

    return this._start(type, name)
  }

  stopDatabase (type, name) {
    const database = _.find(this.started, { type: type, name: name })

    if (!database) {
      return
    }

    return this._stop(database)
  }

  _start (type, name) {
    return new Promise((resolve, reject) => {
      const file = `${name}.js`

      try {
        const database = require(this.databasesDir + type.toLowerCase() + '/' + file)

        return database.start()
          .then((result) => {
            this.started.push(database)

            Logger.debug('Started ' + type.toLowerCase() + ' database: ' + database.name)

            resolve(result)
          })
          .catch((error) => reject(error))
      } catch (error) {
        Logger.error('Unable to start ' + type.toLowerCase() + ' database ' + file + ' because ' + error.message)

        reject(new Error('unable to start ' + type.toLowerCase() + ' database ' + file))
      }
    })
  }

  _stop (database) {
    return database.stop()
      .then(() => {
        _.remove(this.started, { name: database.name })

        Logger.debug('Stopped database: ' + database.name)
      })
      .catch((error) => {
        Logger.debug('Unable to stop database ' + database.name + ' because ' + error.message)
        throw new Error('Unable to stop database ' + database.name)
      })
  }
}

module.exports = new Databases()
