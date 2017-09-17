/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Database = require('./database')

const _ = require('lodash')

const Sequelize = require('sequelize')

const { join } = require('path')

const defaultOptions = {
  database: { name: 'monitor' },
  sequelize: {
    pathDir: join(__dirname, '../../var/tmp'),
    filename: 'monitor.db'
  }
}

class Monitor extends Database {
  constructor (options = {}) {
    super(_.defaultsDeep(options, defaultOptions))

    this._models = {
      arp: this._sequelize.define('arp', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        ip_address: { type: Sequelize.TEXT, allowNull: false },
        mac_address: { type: Sequelize.TEXT, allowNull: false }
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'ip_address', 'mac_address' ] } ]
      }),
      bonjour: this._sequelize.define('bonjour', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        type: { type: Sequelize.TEXT, allowNull: false },
        name: { type: Sequelize.TEXT, allowNull: false },
        hostname: { type: Sequelize.TEXT, allowNull: false },
        ip_address: { type: Sequelize.TEXT, allowNull: false },
        port: { type: Sequelize.INTEGER },
        txt: { type: Sequelize.TEXT, allowNull: false },
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'type', 'name' ] } ]
      }),
      upnp: this._sequelize.define('upnp', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        location: { type: Sequelize.TEXT, allowNull: false },
        ip_address: { type: Sequelize.TEXT, allowNull: false },
        device_friendly_name: { type: Sequelize.TEXT, allowNull: false },
        device_model_name: { type: Sequelize.TEXT },
        device_model_description: { type: Sequelize.TEXT },
        device_manufacturer: { type: Sequelize.TEXT }
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'ip_address' ] } ]
      }),
      ip: this._sequelize.define('ip', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        ip_address: { type: Sequelize.TEXT, allowNull: false }
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'ip_address' ] } ]
      }),
      dhcp: this._sequelize.define('dhcp', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        mac_address: { type: Sequelize.TEXT, allowNull: false },
        hostname: { type: Sequelize.TEXT, allowNull: false }
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'mac_address', 'hostname' ] } ]
      }),
      slack: this._sequelize.define('slack', {
        id: { primaryKey: true, autoIncrement: true, type: Sequelize.INTEGER, allowNull: false },
        slack_id: { type: Sequelize.TEXT, allowNull: false },
        username: { type: Sequelize.TEXT, allowNull: false },
        name: { type: Sequelize.TEXT, allowNull: false }
      }, {
        underscored: true,
        createdAt: 'created_date',
        updatedAt: 'updated_date',
        indexes: [ { unique: true, fields: [ 'slack_id' ] } ]
      }),
    }
  }

  get models () {
    return this._models
  }

  get arp () {
    return this._models[ 'arp' ]
  }

  get bonjour () {
    return this._models[ 'bonjour' ]
  }

  get upnp () {
    return this._models[ 'upnp' ]
  }

  get ip () {
    return this._models[ 'ip' ]
  }

  get dhcp () {
    return this._models[ 'dhcp' ]
  }

  get slack () {
    return this._models[ 'slack' ]
  }
}

module.exports = new Monitor()
