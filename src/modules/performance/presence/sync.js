/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash'),
  moment = require('moment'),
  Promise = require("bluebird");

var utils = require('../../utils.js');

function presence() {
}

presence.prototype.start = function () {

  utils.startListening.bind(this)({
    'sync:incoming:person:employee:create': this._onCreateEmployeeIncomingSynchronization.bind(this),
    'sync:outgoing:performance:presence': this._onOutgoingPresenceSynchronization.bind(this),
    'sync:incoming:performance:presence:stats': this._onIncomingStatsSynchronization.bind(this),
    'sync:outgoing:performance:presence:stats': this._onOutgoingStatsSynchronization.bind(this)
  });

  this.communication.emitAsync('sync:outgoing:periodic:register', {
    companyResource: 'employee_performances',
    event: 'sync:outgoing:performance:presence'
  });

  this.communication.emitAsync('sync:outgoing:periodic:register', {
    companyResource: 'employee_performances',
    event: 'sync:outgoing:performance:presence:stats'
  });

};

presence.prototype.stop = function () {

  utils.stopListening.bind(this)([
    'sync:incoming:person:employee:create',
    'sync:outgoing:performance:presence',
    'sync:incoming:performance:presence:stats',
    'sync:outgoing:performance:presence:stats'
  ]);

};

presence.prototype._onCreateEmployeeIncomingSynchronization = function (employee) {
  var self = this;

  _.forEach(['day', 'month', 'year', 'all-time'], function (period) {
    self.communication.emitAsync('sync:incoming:register:setup', {
      companyResource: 'employee_performances',
      period: period,
      employeeId: employee.id,
      name: 'presence',
      onCompanyResourceChangedCallback: function (stats, date) {
        // TODO: Should be removed. Currently used for backwards compatible with previous stats model.
        var _stats = _.clone(stats);
        if (!_stats.started_date) {
          _stats.started_date = date;
        }
        if (!_stats.period) {
          _stats.period = period;
        }

        self.communication.emit('sync:incoming:performance:presence:stats', employee, period, _stats);
      }
    });
  });
};

presence.prototype._onOutgoingPresenceSynchronization = function (params, callback) {
  var self = this;

  this.communication.emit('database:performance:retrieveOneByOne',
    'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
      if (!error) {
        if (row !== undefined) {
          row.created_date = new Date(row.created_date.replace(' ', 'T'));
          row.is_present = row.is_present == 1;
          row.name = self.name;

          callback(null, row, function (error) {
            if (!error) {
              self.communication.emit('database:performance:update',
                'UPDATE presence SET is_synced = 1 WHERE id = ?', [row.id]);
            }
          });
        }
      }
    });
};

presence.prototype._onIncomingStatsSynchronization = function (employee, period, stats) {
  if (!stats || !period) {
    return;
  }

  var _stats = _.extend(stats, {is_synced: true});

  this._createOrUpdateStatsByEmployeeIdAndPeriod(employee.id, period, _stats);
};

presence.prototype._onOutgoingStatsSynchronization = function (params, callback) {
  var self = this;

  this._findAllEmployees()
    .mapSeries(function (employee) {

      return Promise.mapSeries(['day', 'month', 'year', 'all-time'], function (period) {
        return self._findStatsByEmployeeIdAndPeriod(employee.id, period)
          .then(function (stats) {

            if (stats && !stats.is_synced) {

              var _stats = _.extend(stats, {employee_id: employee.id, name: self.name});

              callback(null, _stats, function (error) {
                if (!error) {
                  stats.is_synced = true;

                  self._createOrUpdateStatsByEmployeeIdAndPeriod(employee.id, period, stats);
                }
              });
            }
          });
      });
    });
};

module.exports = presence;