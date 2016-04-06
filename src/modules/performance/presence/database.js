/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');

function presence() {
}

presence.prototype._createPresence = function (presence) {
    if (presence.created_date !== undefined && presence.created_date !== null) {
        presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(presence);
    var values = _.values(presence);

    return this.communication.emitAsync('database:performance:create',
        "INSERT INTO presence (" + keys + ") VALUES (" + values.map(function () {
            return '?';
        }) + ");", values)
      .catch(function (error) {
      });
};

presence.prototype._findLatestPresenceByEmployeeId = function (id) {
    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;", [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findAllPresencesByEmployeeIdAndBetweenDates = function (id, startDate, endDate) {
    var _startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    var _endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return this.communication.emitAsync('database:performance:retrieveAll',
        "SELECT * from presence " +
        "WHERE employee_id = ? " +
        "AND Datetime(?) < created_date AND created_date < Datetime(?) " +
        "ORDER BY created_date ASC;",
        [id, _startDate, _endDate]
    ).then(function (rows) {
        if (rows !== undefined) {
            rows.forEach(function (row) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            });

            return rows;
        }
    });
};

presence.prototype._findAllEmployees = function () {
    return this.communication.emitAsync('database:person:retrieveAll', 'SELECT * FROM employee;', []);
};

presence.prototype._createOrUpdateStatsByEmployeeIdAndPeriod = function (employeeId, period, stats) {
    return this.communication.emitAsync('database:nosql:performance:set', 'presence:stats:' + period, employeeId, stats);
};

presence.prototype._findStatsByEmployeeIdAndPeriod = function (employeeId, period) {
    return this.communication.emitAsync('database:nosql:performance:get', 'presence:stats:' + period, employeeId);
};

module.exports = presence;