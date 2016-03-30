/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var moment = require('moment'),
  _ = require('lodash'),
  Promise = require('bluebird');

var utils = require('../utils.js');

var LP = require('linkedin-public-profile-parser');

function LinkedIn() {
}

LinkedIn.prototype.type = "social";

LinkedIn.prototype.name = "linkedin";

LinkedIn.prototype.events = {};

LinkedIn.prototype.load = function (communication, config) {
  this.communication = communication;

  this.start();
};

LinkedIn.prototype.unload = function () {
  this.stop();

};

LinkedIn.prototype.start = function () {
  utils.startListening.bind(this)({
    'social:linkedin:profile:import': this._importProfile.bind(this),
    'social:linkedin:profile:import:auto': this._autoImportProfile.bind(this),
    'social:linkedin:company:import': this._importCompany.bind(this)
  });

  this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import:auto', null, '6 hours');
};

LinkedIn.prototype.stop = function () {
  this.communication.emit('worker:job:dequeue', 'social:linkedin:profile:import:auto');

  utils.stopListening.bind(this)([
    'social:linkedin:profile:import',
    'social:linkedin:profile:import:auto',
    'social:linkedin:company:import'
  ]);
};

LinkedIn.prototype._importProfile = function (params, callback) {
  var _this = this;

  var employeeId = params.employee.id;

  if (!employeeId) {
    return callback();
  }

  return this._findEmployeeById(employeeId)
    .then(function (employee) {

      if (!employee || !employee.linkedin_profile_url) {
        return callback();
      }

      LP.profile(employee.linkedin_profile_url, function (error, data) {
        if (error) {
          return callback(error);
        }

        employee.full_name = data.fullname || employee.full_name;
        employee.professional_headline = data.current || employee.professional_headline;
        employee.picture_url = data.picture || employee.picture_url;
        employee.updated_date = new Date();
        employee.linkedin_last_import_date = new Date();
        employee.is_synced = false;

        return _this._updateEmployeeById(employee.id, employee)
          .then(function () {
            _this.communication.emit('person:employee:update', employee);
          })
          .then(function () {
            return callback(null, data);
          })
          .catch(callback);
      });

    })
    .catch(callback);
};

LinkedIn.prototype._autoImportProfile = function (params, callback) {
  var _this = this;

  var linkedInLastImportDate = moment().subtract(1, 'week').toDate();

  return this._findAllEmployeesBeforeLinkedInLastImportDate(linkedInLastImportDate)
    .mapSeries(function (employee) {
      _this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import', {employee: employee});
    })
    .then(function () {
      callback();
    })
    .catch(callback);
};

LinkedIn.prototype._importCompany = function (params, callback) {
  var _this = this;

  var linkedInCompanyPageUrl = params.app.company_page_url;

  if (!linkedInCompanyPageUrl) {
    return callback();
  }

  LP.company(linkedInCompanyPageUrl, function (error, data) {
    if (error) {
      return callback(error);
    } else {

      Promise.mapSeries(data.employee_urls, function (employee_url) {
          return _this._findEmployeeByLinkedInProfileUrl(employee_url)
            .then(function (employee) {
              if (!employee) {
                employee = {};
                employee.id = _this._generatePushID();
                employee.created_date = new Date();
                employee.updated_date = new Date();
                employee.linkedin_profile_url = employee_url;

                return _this._addEmployee(employee)
                  .then(function () {
                    _this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import', {employee: employee});
                  })
              }
            })
        })
        .then(function () {
          return callback(null, data);
        })
        .catch(callback);
    }
  });

};

LinkedIn.prototype._findAllEmployeesBeforeLinkedInLastImportDate = function (linkedInLastImportDate) {
  var _linkedInLastImportDate = linkedInLastImportDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

  return this.communication.emitAsync('database:person:retrieveAll',
    'SELECT * FROM employee WHERE linkedin_last_import_date < Datetime(?) OR linkedin_last_import_date IS NULL;', [_linkedInLastImportDate])
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

LinkedIn.prototype._findEmployeeByLinkedInProfileUrl = function (url) {
  return this.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM employee WHERE linkedin_profile_url = ?;", [url])
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

LinkedIn.prototype._addEmployee = function (employee) {
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

  return this.communication.emitAsync('database:person:create',
    'INSERT INTO employee (' + keys + ') VALUES (' + values.map(function () {
      return '?';
    }) + ');',
    values);
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

LinkedIn.prototype._generatePushID = (function () {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

  // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
  var lastPushTime = 0;

  // We generate 72-bits of randomness which get turned into 12 characters and appended to the
  // timestamp to prevent collisions with other clients.  We store the last characters we
  // generated because in the event of a collision, we'll use those same characters except
  // "incremented" by one.
  var lastRandChars = [];

  return function () {
    var now = new Date().getTime();
    var duplicateTime = (now === lastPushTime);
    lastPushTime = now;

    var timeStampChars = new Array(8);
    for (var i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64);
    }
    if (now !== 0) throw new Error('We should have converted the entire timestamp.');

    var id = timeStampChars.join('');

    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[i] = Math.floor(Math.random() * 64);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
        lastRandChars[i] = 0;
      }
      lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if (id.length != 20) throw new Error('Length should be 20.');

    return id;
  };
})();

module.exports = new LinkedIn();