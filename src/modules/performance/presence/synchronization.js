/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');

module.exports = function (parent, instance) {

    parent.prototype._onCreateEmployeeIncomingSynchronization = function (employee) {
        if (!instance.latestMonthlyStats[employee.id]) {
            instance.communication.emitAsync('synchronization:incoming:register:setup', {
                companyResource: 'employee_performances',
                employeeId: employee.id,
                name: 'presence',
                onCompanyResourceChangedCallback: function (performance) {
                    instance.communication.emit('synchronization:incoming:performance:presence', performance);
                },
                onCompanyResourceRemovedCallback: function (performance) {
                }
            });

            instance.communication.emitAsync('synchronization:incoming:register:setup', {
                companyResource: 'employee_performances',
                period: 'monthly',
                employeeId: employee.id,
                name: 'presence',
                onCompanyResourceChangedCallback: function (_stats) {
                    instance.communication.emit('synchronization:incoming:performance:presence:monthly:stats', employee, _stats);
                }
            });
        }

        if (!instance.latestYearlyStats[employee.id]) {
            instance.communication.emitAsync('synchronization:incoming:register:setup', {
                companyResource: 'employee_performances',
                period: 'yearly',
                employeeId: employee.id,
                name: 'presence',
                onCompanyResourceChangedCallback: function (_stats) {
                    instance.communication.emit('synchronization:incoming:performance:presence:yearly:stats', employee, _stats);
                }
            });
        }

        if (!instance.latestAlltimeStats[employee.id]) {
            instance.communication.emitAsync('synchronization:incoming:register:setup', {
                companyResource: 'employee_performances',
                period: 'alltime',
                employeeId: employee.id,
                name: 'presence',
                onCompanyResourceChangedCallback: function (_stats) {
                    instance.communication.emit('synchronization:incoming:performance:presence:alltime:stats', employee, _stats);
                }
            });
        }
    };

    parent.prototype._onIncomingPresenceSynchronization = function (syncingPresence) {
        instance.communication.emit('database:performance:retrieveAll', 'PRAGMA table_info(presence)', [], function (error, rows) {

            syncingPresence = _.pick(syncingPresence, _.pluck(rows, 'name'));

            instance._findLatestPresenceByEmployeeId(syncingPresence.employee_id).then(function (presence) {
                if (presence === undefined) {
                    return instance._createPresence(syncingPresence);
                } else if (moment(syncingPresence.created_date).isAfter(presence.created_date)) {
                    return instance._createPresence(syncingPresence);
                }
            }).catch(function (error) {
                logger.error(error.stack);
            });
        });
    };

    parent.prototype._onOutgoingPresenceSynchronization = function (params, callback) {
        instance.communication.emit('database:performance:retrieveOneByOne',
            'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
                if (error) {
                    logger.error(error.stack);
                } else {

                    if (row !== undefined) {
                        row.created_date = new Date(row.created_date.replace(' ', 'T'));
                        row.is_present = row.is_present == 1;
                        row.name = instance.name;

                        callback(error, row, function (error) {
                            if (error) {
                                logger.error(error.stack)
                            } else {
                                instance.communication.emit('database:performance:update',
                                    'UPDATE presence SET is_synced = 1 WHERE id = ?', [row.id], function (error) {
                                        if (error) {
                                            logger.error(error.stack);
                                        }
                                    });
                            }
                        });
                    }
                }
            });
    };

};