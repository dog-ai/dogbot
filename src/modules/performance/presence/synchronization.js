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

    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSampleSynchronization.bind(this));
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSampleSynchronization.bind(this));
    this.communication.on('synchronization:incoming:performance:presence:stats', this._onIncomingPresenceStatsSynchronization.bind(this));
    this.communication.on('synchronization:outgoing:performance:presence:stats', this._onOutgoingPresenceStatsSynchronization.bind(this));


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

    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSampleSynchronization.bind(this));
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSampleSynchronization.bind(this));
    this.communication.removeListener('synchronization:incoming:performance:presence:stats', this._onIncomingPresenceStatsSynchronization.bind(this));
    this.communication.removeListener('synchronization:outgoing:performance:presence:stats', this._onOutgoingPresenceStatsSynchronization.bind(this));

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
            onCompanyResourceChangedCallback: function (stats) {
                self.communication.emit('synchronization:incoming:performance:presence:stats', employee, stats, period);
            }
        });
    });
};

presence.prototype._onIncomingPresenceSampleSynchronization = function (syncingPresence) {
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

presence.prototype._onOutgoingPresenceSampleSynchronization = function (params, callback) {
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

presence.prototype._onIncomingPresenceStatsSynchronization = function (employee, stats, period) {
    var _stats = _.extend(stats, {is_synced: true});
    this._createOrUpdateStatsByEmployeeId(employee.id, _stats, period);
};

presence.prototype._onOutgoingPresenceStatsSynchronization = function (params, callback) {
    var self = this;

    this._findAllEmployees()
        .mapSeries(function (employee) {

            return Promise.mapSeries(['daily', 'monthly', 'yearly', 'alltime'], function (period) {
                return self._findStatsByEmployeeId(employee.id, period)
                    .then(function (stats) {

                        if (stats && !stats.is_synced) {

                            var _stats = _.extend(stats, {employee_id: employee.id, name: self.name});

                            callback(null, _stats, function (error) {
                                if (error) {
                                    logger.error(error.stack);
                                } else {

                                    stats.is_synced = true;

                                    self._createOrUpdateStatsByEmployeeId(employee.id, stats, period);
                                }
                            });
                        }
                    });
            });
        });
};

module.exports = presence;