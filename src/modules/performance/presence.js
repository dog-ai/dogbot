/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PerformanceModule = require('./performance-module')

const Server = require('../../server')

const { Performance } = require('../../databases')

const moment = require('moment')

const enqueueStatsUpdateTask = (params, callback) => {
  const companyId = Server.getCompanyId()

  if (!companyId) {
    return callback()
  }

  Server.enqueueTask('performance:presence:stats:update', [ companyId ])
    .then(() => callback())
    .catch((error) => callback(error))
}

const addPresence = (employee) => {
  return Performance.presence.findById(employee.id, { order: [ [ 'created_date', 'DESC' ] ] })
    .then((performance) => {
      if (performance) {
        if (performance.is_present === employee.is_present) {
          return
        }

        if (moment(employee.last_presence_date).isSame(moment(performance.created_date))) {
          employee.last_presence_date = moment(employee.last_presence_date).add(1, 'second').toDate()
        }
      }

      return Performance.presence.create({
        employee_id: employee.id,
        is_present: employee.is_present,
        created_date: employee.last_presence_date
      })
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
      'person:employee:faraway': addPresence
    })

    Server.enqueueJob('performance:presence:stats:update', null, { schedule: '6 hours' })
  }

  stop () {
    Server.dequeueJob('performance:presence:stats:update')

    super.stop()
  }
}

module.exports = new Presence()
