/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash'),
    moment = require('moment');

function presence() {
}

presence.prototype._createPresence = function (presence) {
    var self = this;

    if (presence.created_date !== undefined && presence.created_date !== null) {
        presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(presence);
    var values = _.values(presence);

    return this.communication.emitAsync('database:performance:create',
        "INSERT INTO presence (" + keys + ") VALUES (" + values.map(function () {
            return '?';
        }) + ");", values);
};

presence.prototype._findLatestPresenceByEmployeeId = function (id) {
    var self = this;


    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;",
        [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findAllPresencesByEmployeeIdAndBetweenDates = function (id, startDate, endDate) {
    var self = this;

    startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return this.communication.emitAsync('database:performance:retrieveAll',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC;",
        [id, startDate, endDate]
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
    if (!employeeId || !period) {
        throw new Error('invalid parameters');
    }

    var dateFormatPattern;
    switch (period) {
        case 'daily':
            dateFormatPattern = 'YYYYMMDD';
        case 'monthly':
            if (!dateFormatPattern) {
                dateFormatPattern = 'YYYYMM';
            }
        case 'yearly':
            if (!dateFormatPattern) {
                dateFormatPattern = 'YYYY';
            }

            return this.communication.emitAsync('database:nosql:performance:hset', 'presence:stats:' + period, employeeId, moment(stats.started_date).format(dateFormatPattern), stats);

            break;

        case 'alltime':
            return this.communication.emitAsync('database:nosql:performance:set', 'presence:stats:' + period, employeeId, stats);

        default:
            throw new Error('invalid parameters');
    }
};

presence.prototype._findAllStatsByEmployeeIdAndPeriod = function (employeeId, period) {
    if (!employeeId || !period) {
        throw new Error('invalid parameters');
    }

    var dateFormatPattern;
    switch (period) {
        case 'daily':
            dateFormatPattern = 'YYYYMMDD';
        case 'monthly':
            if (!dateFormatPattern) {
                dateFormatPattern = 'YYYYMM';
            }
        case 'yearly':
            if (!dateFormatPattern) {
                dateFormatPattern = 'YYYY';
            }

            return this.communication.emitAsync('database:nosql:performance:hgetall', 'presence:stats:' + period, employeeId);

        case 'alltime':
            return this.communication.emitAsync('database:nosql:performance:get', 'presence:stats:' + period, employeeId)
                .then(function (stats) {
                    return [stats];
                });

        default:
            throw new Error('invalid parameters');
    }
};

module.exports = presence;