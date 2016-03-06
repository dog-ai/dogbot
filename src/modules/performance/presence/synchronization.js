/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger'),
    _ = require('lodash'),
    moment = require('moment'),
    Promise = require("bluebird");

function presence() {
}

presence.prototype.start = function () {

    this.communication.on('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization.bind(this));

    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization.bind(this));
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization.bind(this));
    this.communication.on('synchronization:incoming:performance:presence:stats', this._onIncomingStatsSynchronization.bind(this));
    this.communication.on('synchronization:outgoing:performance:presence:stats', this._onOutgoingStatsSynchronization.bind(this));


    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence'
    });


    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence:stats'
    });

};

presence.prototype.stop = function () {

    this.communication.removeListener('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization.bind(this));

    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization.bind(this));
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization.bind(this));
    this.communication.removeListener('synchronization:incoming:performance:presence:stats', this._onIncomingStatsSynchronization.bind(this));
    this.communication.removeListener('synchronization:outgoing:performance:presence:stats', this._onOutgoingStatsSynchronization.bind(this));

};

presence.prototype._onCreateEmployeeIncomingSynchronization = function (employee) {
    var self = this;

    this.communication.emitAsync('synchronization:incoming:register:setup', {
        companyResource: 'employee_performances',
        employeeId: employee.id,
        name: 'presence',
        onCompanyResourceChangedCallback: function (performance) {
            self.communication.emit('synchronization:incoming:performance:presence', performance);
        },
        onCompanyResourceRemovedCallback: function (performance) {
        }
    });

    _.forEach(['daily', 'monthly', 'yearly', 'alltime'], function (period) {
        self.communication.emitAsync('synchronization:incoming:register:setup', {
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

                self.communication.emit('synchronization:incoming:performance:presence:stats', employee, period, _stats);
            }
        });
    });
};

presence.prototype._onIncomingPresenceSynchronization = function (syncingPresence) {
    var self = this;

    this.communication.emit('database:performance:retrieveAll', 'PRAGMA table_info(presence)', [], function (error, rows) {

        syncingPresence = _.pick(syncingPresence, _.pluck(rows, 'name'));

        self._findLatestPresenceByEmployeeId(syncingPresence.employee_id).then(function (presence) {
            if (presence === undefined) {
                return self._createPresence(syncingPresence);
            } else if (moment(syncingPresence.created_date).isAfter(presence.created_date)) {
                return self._createPresence(syncingPresence);
            }
        }).catch(function (error) {
            logger.error(error.stack);
        });
    });
};

presence.prototype._onOutgoingPresenceSynchronization = function (params, callback) {
    var self = this;

    this.communication.emit('database:performance:retrieveOneByOne',
        'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
            if (error) {
                logger.error(error.stack);
            } else {

                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.is_present = row.is_present == 1;
                    row.name = self.name;

                    callback(null, row, function (error) {
                        if (error) {
                            logger.error(error.stack)
                        } else {
                            self.communication.emit('database:performance:update',
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

            return Promise.mapSeries(['daily', 'monthly', 'yearly', 'alltime'], function (period) {
                return self._findStatsByEmployeeIdAndPeriod(employee.id, period)
                    .then(function (stats) {

                        if (stats && !stats.is_synced) {

                            var _stats = _.extend(stats, {employee_id: employee.id, name: self.name});

                            callback(null, _stats, function (error) {
                                if (error) {
                                    logger.error(error.stack);
                                } else {

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