/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var moment = require('moment'),
  _ = require('lodash');

var utils = require('../../../utils.js');

var LP = require('linkedin-public-profile-parser');

function LinkedIn() {
}

LinkedIn.prototype.type = "person";

LinkedIn.prototype.name = "linkedin";

LinkedIn.prototype.events = {};

LinkedIn.prototype.load = function (communication) {
  this.communication = communication;

  this.start();
};

LinkedIn.prototype.unload = function () {
  this.stop();

};

LinkedIn.prototype.start = function () {
  utils.startListening.bind(this)({
    'person:employee:profile:linkedin': this._import.bind(this),
    'person:employee:profile:linkedin:auto': this._auto.bind(this)
  });

  this.communication.emit('worker:job:enqueue', 'person:employee:profile:linkedin:auto', null, '6 hours');
};

LinkedIn.prototype.stop = function () {
  utils.stopListening.bind(this)([
    'person:employee:profile:linkedin',
    'person:employee:profile:linkedin:auto'
  ]);
};

LinkedIn.prototype._auto = function (params, callback) {
  var _this = this;

  var linkedInLastImportDate = moment().subtract(1, 'week').toDate();

  return this._findAllEmployeesBeforeLinkedInLastImportDate(linkedInLastImportDate)
    .mapSeries(function (employee) {
      _this.communication.emit('person:employee:profile:linkedin', {employee: employee});
    })
    .then(callback)
    .catch(callback);
}

LinkedIn.prototype._import = function (params, callback) {
  var _this = this;

  var employeeId = params.employee.id;

  return this._findEmployeeById(employeeId)
    .then(function (employee) {

      if (!employee || !employee.linkedin_profile_url) {
        return callback();
      }

      LP(employee.linkedin_profile_url, function (error, data) {

        if (!error) {
          employee.full_name = data.fullname || employee.full_name;
          employee.professional_headline = data.current || employee.professional_headline;
          employee.picture_url = data.picture || employee.picture_url;
        }

        employee.is_synced = false;
        employee.updated_date = new Date();
        employee.linkedin_last_import_date = new Date();

        return _this._updateEmployeeById(employee.id, employee)
          .then(function () {
            _this.communication.emit('person:employee:update', employee);

            return callback(error, data);
          })
          .catch(callback);
      });

    });
};

LinkedIn.prototype._findAllEmployeesBeforeLinkedInLastImportDate = function (linkedInLastImportDate) {
  var _linkedInLastImportDate = linkedInLastImportDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  return this.communication.emitAsync('database:person:retrieveAll',
    'SELECT * FROM employee WHERE last_presence_date < Datetime(?);', [_linkedInLastImportDate])
    .then(function (rows) {
      if (rows !== undefined) {
        rows.forEach(function (row) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
          if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
            row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
          }
          if (row.linkedin_last_import_date !== undefined && row.linkedin_last_import_date !== null) {
            row.linkedin_last_import_date = new Date(row.linkedin_last_import_date.replace(' ', 'T'));
          }
        });
      }

      return rows;
    });
};

LinkedIn.prototype._findEmployeeById = function (id) {
  return this.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM employee WHERE id = ?;", [id])
    .then(function (row) {
      if (row !== undefined) {
        row.created_date = new Date(row.created_date.replace(' ', 'T'));
        row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
        if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
          row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
        }
        if (row.linkedin_last_import_date !== undefined && row.linkedin_last_import_date !== null) {
          row.linkedin_last_import_date = new Date(row.linkedin_last_import_date.replace(' ', 'T'));
        }
      }

      return row;
    });
};

LinkedIn.prototype._updateEmployeeById = function (id, employee) {
  var _employee = _.clone(employee);

  if (_employee.created_date !== undefined && _employee.created_date !== null && _employee.created_date instanceof Date) {
    _employee.created_date = _employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_employee.updated_date !== undefined && _employee.updated_date !== null && _employee.updated_date instanceof Date) {
    _employee.updated_date = _employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_employee.last_presence_date !== undefined && _employee.last_presence_date !== null && _employee.last_presence_date instanceof Date) {
    _employee.last_presence_date = _employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  if (_employee.linkedin_last_import_date !== undefined && _employee.linkedin_last_import_date !== null && _employee.linkedin_last_import_date instanceof Date) {
    _employee.linkedin_last_import_date = _employee.linkedin_last_import_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  var keys = _.keys(_employee);
  var values = _.values(_employee);

  return this.communication.emitAsync('database:person:update',
    'UPDATE employee SET ' + keys.map(function (key) {
      return key + ' = ?';
    }) + ' WHERE id = \'' + id + '\';',
    values);
};

module.exports = new LinkedIn();