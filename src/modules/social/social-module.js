/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const Server = require('../../server')

const _ = require('lodash')

class SocialModule extends Module {
  constructor (name) {
    super('social', name)
  }

  _findAllEmployeesBeforeLinkedInLastImportDate (linkedInLastImportDate) {
    var _linkedInLastImportDate = linkedInLastImportDate.toISOString().replace(/T/, ' ').replace(/\..+/, '')

    return Server.emitAsync('database:person:retrieveAll',
      'SELECT * FROM employee WHERE linkedin_last_import_date < Datetime(?) OR linkedin_last_import_date IS NULL', [ _linkedInLastImportDate ])
      .then((rows) => {
        if (rows !== undefined) {
          rows.forEach((row) => {
            row.created_date = new Date(row.created_date.replace(' ', 'T'))
            row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
            if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
              row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'))
            }
            if (row.linkedin_last_import_date !== undefined && row.linkedin_last_import_date !== null) {
              row.linkedin_last_import_date = new Date(row.linkedin_last_import_date.replace(' ', 'T'))
            }
          })
        }

        return rows
      })
  }

  _findEmployeeById (id) {
    return Server.emitAsync('database:person:retrieveOne', 'SELECT * FROM employee WHERE id = ?', [ id ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
          if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
            row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'))
          }
          if (row.linkedin_last_import_date !== undefined && row.linkedin_last_import_date !== null) {
            row.linkedin_last_import_date = new Date(row.linkedin_last_import_date.replace(' ', 'T'))
          }
        }

        return row
      })
  }

  _findEmployeeByLinkedInProfileUrl (url) {
    return Server.emitAsync('database:person:retrieveOne', 'SELECT * FROM employee WHERE linkedin_profile_url = ?', [ url ])
      .then((row) => {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'))
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'))
          if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
            row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'))
          }
          if (row.linkedin_last_import_date !== undefined && row.linkedin_last_import_date !== null) {
            row.linkedin_last_import_date = new Date(row.linkedin_last_import_date.replace(' ', 'T'))
          }
        }

        return row
      })
  }

  _addEmployee (employee) {
    var _employee = _.clone(employee)

    if (_employee.created_date !== undefined && _employee.created_date !== null && _employee.created_date instanceof Date) {
      _employee.created_date = _employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.updated_date !== undefined && _employee.updated_date !== null && _employee.updated_date instanceof Date) {
      _employee.updated_date = _employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.last_presence_date !== undefined && _employee.last_presence_date !== null && _employee.last_presence_date instanceof Date) {
      _employee.last_presence_date = _employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.linkedin_last_import_date !== undefined && _employee.linkedin_last_import_date !== null && _employee.linkedin_last_import_date instanceof Date) {
      _employee.linkedin_last_import_date = _employee.linkedin_last_import_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_employee)
    var values = _.values(_employee)

    return Server.emitAsync('database:person:create',
      'INSERT INTO employee (' + keys + ') VALUES (' + values.map(() => {
        return '?'
      }) + ')',
      values)
  }

  _updateEmployeeById (id, employee) {
    var _employee = _.clone(employee)

    if (_employee.created_date !== undefined && _employee.created_date !== null && _employee.created_date instanceof Date) {
      _employee.created_date = _employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.updated_date !== undefined && _employee.updated_date !== null && _employee.updated_date instanceof Date) {
      _employee.updated_date = _employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.last_presence_date !== undefined && _employee.last_presence_date !== null && _employee.last_presence_date instanceof Date) {
      _employee.last_presence_date = _employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    if (_employee.linkedin_last_import_date !== undefined && _employee.linkedin_last_import_date !== null && _employee.linkedin_last_import_date instanceof Date) {
      _employee.linkedin_last_import_date = _employee.linkedin_last_import_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }

    var keys = _.keys(_employee)
    var values = _.values(_employee)

    return Server.emitAsync('database:person:update',
      'UPDATE employee SET ' + keys.map((key) => {
        return key + ' = ?'
      }) + ' WHERE id = \'' + id + '\';',
      values)
  }
}

module.exports = SocialModule
