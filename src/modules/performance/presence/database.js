/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');

module.exports = function (parent, instance) {

    parent.prototype._createPresence = function (presence) {
        if (presence.created_date !== undefined && presence.created_date !== null) {
            presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }

        var keys = _.keys(presence);
        var values = _.values(presence);

        return instance.communication.emitAsync('database:performance:create',
            "INSERT INTO presence (" + keys + ") VALUES (" + values.map(function () {
                return '?';
            }) + ");", values);
    };

    parent.prototype._findLatestPresenceByEmployeeId = function (id) {
        return instance.communication.emitAsync('database:performance:retrieveOne',
            "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;",
            [id])
            .then(function (row) {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                }

                return row;
            });
    };

    parent.prototype._findLastDatePresenceByEmployeeId = function (id, startDate, endDate) {
        startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

        return instance.communication.emitAsync('database:performance:retrieveOne',
            "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date DESC LIMIT 1;",
            [id, startDate, endDate])
            .then(function (row) {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                }

                return row;
            });
    };

    parent.prototype._findFirstDatePresenceByEmployeeId = function (id, startDate, endDate) {
        startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

        return instance.communication.emitAsync('database:performance:retrieveOne',
            "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC LIMIT 1;",
            [id, startDate, endDate])
            .then(function (row) {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                }

                return row;
            });
    };

    parent.prototype._findAllByEmployeeIdAndBetweenDates = function (id, startDate, endDate) {
        startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

        return instance.communication.emitAsync('database:performance:retrieveAll',
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

    parent.prototype._findAllEmployees = function () {
        return instance.communication.emitAsync('database:person:retrieveAll', 'SELECT * FROM employee;', []);
    };

    parent.prototype._createOrUpdateStatsByEmployeeId = function (id, stats, period) {
        return instance.communication.emitAsync('database:nosql:performance:set', 'presence:stats:' + period, id, stats);
    };

    parent.prototype._findStatsByEmployeeId = function (id, period) {
        return instance.communication.emitAsync('database:nosql:performance:get', 'presence:stats:' + period, id);
    };
};