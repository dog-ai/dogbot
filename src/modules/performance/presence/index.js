/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment');

function presence() {
}
presence.prototype.type = "PERFORMANCE";

presence.prototype.name = "presence";

presence.prototype.submodules = [
    './stats'
];

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.load = function (communication) {
    this.communication = communication;

    _.forEach(this.submodules, function (submodule) {
        require(submodule)(presence, instance);
    });

    this.start();
};

presence.prototype.unload = function () {
    this.stop();

    _.forEach(this.submodules, function (submodule) {
        delete require.cache[require.resolve(submodule)];
    });
};

presence.prototype.start = function () {
    this.communication.on('person:employee:nearby', this._onEmployeePresence);
    this.communication.on('person:employee:faraway', this._onEmployeePresence);
    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence'
    });

    this.communication.on('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.on('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.on('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.on('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);
    this.communication.on('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);
    /*this.communication.emit('worker:job:enqueue', 'performance:presence:daily:stats', null, '01 00 00 * * *');
     this.communication.emit('worker:job:enqueue', 'performance:presence:monthly:stats', null, '02 00 00 * * *');
     this.communication.emit('worker:job:enqueue', 'performance:presence:alltime:stats', null, '03 00 00 * * *');*/
};

presence.prototype.stop = function () {
    this.communication.removeListener('person:employee:nearby', this._onEmployeePresence);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresence);
    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);

    this.communication.removeListener('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.removeListener('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.removeListener('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.removeListener('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);
    this.communication.emit('worker:job:dequeue', 'performance:presence:daily:stats');
    this.communication.emit('worker:job:dequeue', 'performance:presence:monthly:stats');
    this.communication.emit('worker:job:dequeue', 'performance:presence:alltime:stats');
};

presence.prototype._onCreateEmployeeIncomingSynchronization = function (employee) {
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

presence.prototype._onEmployeePresence = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id).then(function (performance) {
        if (performance !== undefined) {
            if (performance.is_present == employee.is_present) {
                return;
            }

            if (moment(employee.last_presence_date).isSame(moment(performance.created_date))) {
                employee.last_presence_date = moment(employee.last_presence_date).add(1, 'second').toDate();
            }
        }

        return instance._createPresence({
            employee_id: employee.id,
            is_present: employee.is_present,
            created_date: employee.last_presence_date
        });
    }).catch(function (error) {
        logger.error(error.stack);
    });
};

presence.prototype._onIncomingPresenceSynchronization = function (syncingPresence) {
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

presence.prototype._onOutgoingPresenceSynchronization = function (params, callback) {
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

presence.prototype._createPresence = function (presence) {
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

presence.prototype._findLastDatePresenceByEmployeeId = function (id, startDate, endDate) {
    startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date DESC LIMIT 1;",
        [id, startDate, endDate])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findFirstDatePresenceByEmployeeId = function (id, startDate, endDate) {
    startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC LIMIT 1;",
        [id, startDate, endDate])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findAllByEmployeeIdAndBetweenDates = function (id, startDate, endDate) {
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

var instance = new presence();

module.exports = instance;

