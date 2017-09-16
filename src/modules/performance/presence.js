/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PerformanceModule = require('./performance-module')

const _ = require('lodash')

const Server = require('../../server')

const moment = require('moment')

const createPresence = (presence) => {
  if (presence.created_date !== undefined && presence.created_date !== null) {
    presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
  }

  const keys = _.keys(presence);
  const values = _.values(presence);

  return Server.emitAsync('database:performance:create',
    'INSERT INTO presence (' + keys + ') VALUES (' + values.map(() => '?') + ');', values)
    .catch((error) => {})
}

const findLatestPresenceByEmployeeId = (id) => {
  return Server.emitAsync('database:performance:retrieveOne',
    'SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;', [ id ])
    .then(function (row) {
      if (row) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'))
      }

      return row;
    })
}

const enqueueStatsUpdateTask = (params, callback) => {
  const companyId = Server.getCompanyId()

  if (!companyId) {
    callback()
  }

  Server.enqueueTask('performance:presence:stats:update', [ companyId ])
    .then(() => callback())
    .catch((error) => callback(error))
}

const addPresence = (employee) => {
  findLatestPresenceByEmployeeId(employee.id)
    .then((performance) => {
      if (performance) {
        if (performance.is_present == employee.is_present) {
          return;
        }

        if (moment(employee.last_presence_date).isSame(moment(performance.created_date))) {
          employee.last_presence_date = moment(employee.last_presence_date).add(1, 'second').toDate()
        }
      }

      return createPresence({
        employee_id: employee.id,
        is_present: employee.is_present,
        created_date: employee.last_presence_date
      })
    })
};

const onOutgoingPresenceSynchronization = (params, callback) => {
  Server.emit('database:performance:retrieveOneByOne',
    'SELECT * FROM presence WHERE is_synced = 0', [], (error, row) => {
      if (!error) {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.is_present = row.is_present == 1
          row.name = 'presence'

          callback(null, row, function (error) {
            if (!error) {
              Server.emit('database:performance:update',
                'UPDATE presence SET is_synced = 1 WHERE id = ?', [ row.id ])
            }
          })
        }
      }
    })
}

class Presence extends PerformanceModule {
  constructor () {
    super('presence')
  }

  start () {
    super.start({
      'performance:presence:stats:update': enqueueStatsUpdateTask,
      'person:employee:nearby': addPresence,
      'person:employee:faraway': addPresence,
      'sync:outgoing:performance:presence': onOutgoingPresenceSynchronization
    })

    const options = { schedule: '6 hours' }
    Server.enqueueJob('performance:presence:stats:update', null, options)

    Server.emit('sync:outgoing:periodic:register', {
      companyResource: 'employee_performances',
      event: 'sync:outgoing:performance:presence'
    })
  }

  stop () {
    Server.dequeueJob('performance:presence:stats:update')

    super.stop()
  }
}

module.exports = new Presence()
