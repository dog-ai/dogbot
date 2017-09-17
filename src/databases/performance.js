/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Database = require('./database')

const _ = require('lodash')

const Server = require('../server')

const Logger = require('modern-logger')

const Sequelize = require('sequelize')

const { join } = require('path')

const onOutgoingPresenceSynchronization = function (params, callback) {
  return this._models.presence.findAll({ where: { is_synced: false } })
    .mapSeries((presence) => {
      presence.name = 'presence'

      callback(null, presence.get({ plain: true }), (error) => {
        if (error) {
          return
        }

        return this._models.presence.update({ is_synced: true }, { where: { id: presence.id } })
      })
    })
    .catch((error) => Logger.error(error))
}

const defaultOptions = {
  database: { name: 'performance' },
  sequelize: {
    pathDir: join(__dirname, '../../var/db'),
    filename: 'performance.db'
  }
}

class Performance extends Database {
  constructor (options = {}) {
    super(_.defaultsDeep(options, defaultOptions))

    this._models = {
      presence: this._sequelize.define('presence', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        employee_id: { type: Sequelize.TEXT, allowNull: false },
        is_present: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
        is_synced: { type: Sequelize.BOOLEAN, defaultValue: 0, allowNull: false },
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'employee_id', 'created_date' ] } ]
      })
    }
  }

  get models () {
    return this._models
  }

  get presence () {
    return this._models[ 'presence' ]
  }

  start () {
    const events = {
      'sync:outgoing:performance:presence': onOutgoingPresenceSynchronization.bind(this)
    }

    return super.start(events)
      .then(() => {
        Server.emit('sync:outgoing:periodic:register', {
          companyResource: 'employee_performances',
          event: 'sync:outgoing:performance:presence'
        })
      })
  }
}

module.exports = new Performance()
