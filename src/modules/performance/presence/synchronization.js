/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger'),
    _ = require('lodash'),
    moment = require('moment'),
    Promise = require("bluebird");

var presence = module.exports;


module.exports = function (parent, instance) {

    parent.prototype._onCreateEmployeeIncomingSynchronization = function (employee) {
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

        _.forEach(['daily', 'monthly', 'yearly', 'alltime'], function (period) {
            instance.communication.emitAsync('synchronization:incoming:register:setup', {
                companyResource: 'employee_performances',
                period: period,
                employeeId: employee.id,
                name: 'presence',
                onCompanyResourceChangedCallback: function (stats) {
                    instance.communication.emit('synchronization:incoming:performance:presence:stats', employee, stats, period);
                }
            });
        });
    };

    parent.prototype._onIncomingPresenceSampleSynchronization = function (syncingPresence) {
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

    parent.prototype._onOutgoingPresenceSampleSynchronization = function (params, callback) {
        instance.communication.emit('database:performance:retrieveOneByOne',
            'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
                if (error) {
                    logger.error(error.stack);
                } else {

                    if (row !== undefined) {
                        row.created_date = new Date(row.created_date.replace(' ', 'T'));
                        row.is_present = row.is_present == 1;
                        row.name = instance.name;

                        callback(null, row, function (error) {
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

    parent.prototype._onIncomingPresenceStatsSynchronization = function (employee, stats, period) {
        var _stats = _.extend(stats, {is_synced: true});
        instance._createOrUpdateStatsByEmployeeId(employee.id, _stats, period);
    };

    parent.prototype._onOutgoingPresenceStatsSynchronization = function (params, callback) {
        instance._findAllEmployees()
            .mapSeries(function (employee) {

                return Promise.mapSeries(['daily', 'monthly', 'yearly', 'alltime'], function (period) {
                    return instance._findStatsByEmployeeId(employee.id, period)
                        .then(function (stats) {

                            if (stats && stats.is_synced) {

                                var _stats = _.extend(stats, {employee_id: employee.id, name: instance.name});

                                callback(null, _stats, function (error) {
                                    if (error) {
                                        logger.error(error.stack);
                                    } else {

                                        stats.is_synced = true;

                                        instance._createOrUpdateStatsByEmployeeId(employee.id, stats, period);
                                    }
                                });
                            }
                        });
                });
            });
    }
};