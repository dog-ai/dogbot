/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const PersonModule = require('./person-module')

const Logger = require('modern-logger')

const onEmployeeNearby = function (employee) {
  Logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is nearby')
}

const onEmployeeFaraway = (employee) => {
  Logger.info(employee.last_presence_date + ' ' + employee.full_name + ' is faraway')
}

class Notification extends PersonModule {
  constructor () {
    super('notification')
  }

  start () {
    super.start({
      'person:employee:nearby': onEmployeeNearby.bind(this),
      'person:employee:faraway': onEmployeeFaraway.bind(this)
    })
  }
}

module.exports = new Notification()
