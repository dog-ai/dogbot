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
  this.config = config;

  this.start();
};

LinkedIn.prototype.unload = function () {
  this.stop();

};

LinkedIn.prototype.start = function () {
  utils.startListening.bind(this)({
    'social:linkedin:profile:import': this._importProfile.bind(this),
    'social:linkedin:profile:import:auto': this._autoImportProfile.bind(this),
    'social:linkedin:company:import': this._importCompany.bind(this),
    'social:linkedin:company:import:auto': this._autoImportCompany.bind(this)
  });

  this.communication.emit('sync:outgoing:quickshot:register', {
    companyResource: 'apps',
    registerEvents: ['social:linkedin:config:update'],
    outgoingFunction: this._onConfigOutgoingSynchronization.bind(this)
  });

  this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import:auto', null, {schedule: '6 hours'});
  this.communication.emit('worker:job:enqueue', 'social:linkedin:company:import:auto', null, {schedule: '6 hours'});
};

LinkedIn.prototype.stop = function () {
  this.communication.emit('worker:job:dequeue', 'social:linkedin:profile:import:auto');

  utils.stopListening.bind(this)([
    'social:linkedin:profile:import',
    'social:linkedin:profile:import:auto',
    'social:linkedin:company:import',
    'social:linkedin:company:import:auto'
  ]);
};

LinkedIn.prototype._onConfigOutgoingSynchronization = function (params, callback) {
  this.config.updated_date = new Date();

  callback(null, this.config);
};

LinkedIn.prototype._getLinkedInProfile = function (linkedInProfileUrl) {
  return new Promise(function (resolve, reject) {
    LP.profile(linkedInProfileUrl, function (error, profile) {
      if (error) {
        return reject(error);
      } else {
        return resolve(profile);
      }
    });
  });
};

LinkedIn.prototype._importProfile = function (params, callback) {
  var _this = this;

  var linkedInProfileUrl = params.employee_linkedin_profile_url;
  var employeeId = params.employee_id;

  function updateEmployeeWithProfile(employee, profile) {
    employee.full_name = profile.fullname || employee.full_name;
    employee.professional_headline = profile.current || employee.professional_headline;
    employee.picture_url = profile.picture || employee.picture_url;
    employee.updated_date = new Date();
    employee.linkedin_profile_url = profile.canonicalurl || employee.linkedin_profile_url;
    employee.linkedin_last_import_date = new Date();
    employee.is_synced = false;

    return employee;
  }

  return _this._getLinkedInProfile(linkedInProfileUrl)
    .then(function (profile) {

      if (employeeId) {
        return _this._findEmployeeById(employeeId)
          .then(function (employee) {
            if (employee) {
              employee = updateEmployeeWithProfile(employee, profile);

              return _this._updateEmployeeById(employee.id, employee)
                .then(function () {
                  _this.communication.emit('person:employee:update', employee);
                });
            }
          })
          .then(function () {
            return profile;
          });
      } else if (profile.canonicalurl) {
        return _this._findEmployeeByLinkedInProfileUrl(profile.canonicalurl)
          .then(function (employee) {
            if (employee) {
              employee = updateEmployeeWithProfile(employee, profile);

              return _this._updateEmployeeById(employee.id, employee)
                .then(function () {
                  _this.communication.emit('person:employee:update', employee);
                });
            } else {
              employee = {};
              employee.id = _this._generatePushID();
              employee.created_date = new Date();
              employee = updateEmployeeWithProfile(employee, profile);

              return _this._addEmployee(employee)
                .then(function () {
                  _this.communication.emit('person:employee:update', employee);
                });
            }
          })
          .then(function () {
            return profile;
          });
      }
    })
    .then(function (profile) {
      return callback(null, profile);
    })
    .catch(callback);
};

LinkedIn.prototype._autoImportProfile = function (params, callback) {
  var _this = this;

  var linkedInLastImportDate = moment().subtract(1, 'week').toDate();

  return this._findAllEmployeesBeforeLinkedInLastImportDate(linkedInLastImportDate)
    .mapSeries(function (employee) {
      if (employee.linkedin_profile_url) {
        _this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import', {
          employee_id: employee.id,
          employee_linkedin_profile_url: employee.linkedin_profile_url
        });
      }
    })
    .then(function () {
      callback();
    })
    .catch(callback);
};

LinkedIn.prototype._importCompany = function (params, callback) {
  var _this = this;

  params = params || {app: {}};

  var linkedInCompanyPageUrl = params.app.company_page_url || this.config.company_page_url;

  if (!linkedInCompanyPageUrl) {
    return callback();
  }

  LP.company(linkedInCompanyPageUrl, function (error, company) {
    if (error) {
      return callback(error);
    } else {

      var employee_urls = _.clone(company.employee_urls);

      return Promise.mapSeries(company.employee_urls, function (employee_url) {

          return _this._getLinkedInProfile(employee_url)
            .then(function (profile) {

              var employee_related_urls = [];

              if (profile.related) {
                for (var i = 0; i < profile.related.length; i++) {
                  if (profile.related[i].headline.indexOf(company.name) != -1) {
                    employee_related_urls.push(profile.related[i].url);
                  }
                }
              }

              employee_urls = _.union(employee_urls, employee_related_urls);

              var employee_related_related_urls = [];

              return Promise.mapSeries(employee_related_urls, function (related_employee_url) {

                  if (!_.includes(employee_urls, related_employee_url)) {
                    return _this._getLinkedInProfile(related_employee_url)
                      .then(function (profile) {

                        if (profile.related) {
                          for (var i = 0; i < profile.related.length; i++) {
                            if (profile.related[i].headline.indexOf(company.name) != -1) {
                              employee_related_related_urls.push(profile.related[i].url);
                            }
                          }
                        }
                      }).delay(20000);
                  }
                })
                .finally(function () {
                  employee_urls = _.union(employee_urls, employee_related_related_urls);
                });
            })
            .delay(20000)
            .catch(function () {
            });

        })
        .then(function () {
          _.forEach(employee_urls, function (employee_url) {
            _this.communication.emit('worker:job:enqueue', 'social:linkedin:profile:import', {employee_linkedin_profile_url: employee_url});
          });
        })
        .then(function () {
          _this.config.last_import_date = new Date();

          _this.communication.emit('social:linkedin:config:update');
        })
        .then(function () {
          return callback(null, employee_urls);
        })
        .catch(callback);
    }
  });

};

LinkedIn.prototype._autoImportCompany = function (params, callback) {
  if (!this.config.last_import_date || moment(this.config.last_import_date).isBefore(moment().subtract(1, 'week'))) {
    this.communication.emit('worker:job:enqueue', 'social:linkedin:company:import');
  }

  callback();
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