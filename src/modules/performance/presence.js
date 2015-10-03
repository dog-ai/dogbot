/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment'),
    later = require('later');

later.date.localTime();

function presence() {
    this.communication = undefined;

    this.generateDailyStats = undefined;
    this.generateMonthlyStats = undefined;
    this.generateYearlyStats = undefined;

    this.latestDailyStats = {};
    this.latestMonthlyStats = {};
    this.latestYearlyStats = {};
}

presence.prototype.type = "PERFORMANCE";

presence.prototype.name = "presence";

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

presence.prototype.unload = function () {
    this.stop();
};

presence.prototype.start = function () {
    this.communication.on('person:employee:nearby', this._onEmployeePresence);
    this.communication.on('person:employee:faraway', this._onEmployeePresence);
    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);

    this.generateDailyStats = later.setInterval(function () {
        var date = moment().subtract(1, 'day');
        instance._generateDailyStats(date);
    }, later.parse.text('at 00:00:01'));

    this.generateMonthlyStats = later.setInterval(function () {
        var date = moment().subtract(1, 'day');
        instance._generateMonthlyStats(date);
    }, later.parse.text('at 00:10:01'));
};

presence.prototype.stop = function () {
    this.generateDailyStats.clear();
    this.generateMonthlyStats.clear();
    this.generateYearlyStats.clear();

    this.communication.removeListener('person:employee:nearby', this._onEmployeePresence);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresence);
    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
};


presence.prototype._onEmployeePresence = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id).then(function (performance) {
        if (performance && performance.is_present == employee.is_present) {
            return;
        }

        return instance._createPresence({employee_id: employee.id, is_present: employee.is_present});
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

presence.prototype._onOutgoingPresenceSynchronization = function (callback) {
    instance.communication.emit('database:performance:retrieveOneByOne',
        'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
            if (error) {
                logger.error(error.stack);
            } else {

                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.is_present = row.is_present == 1;

                    callback(error, row.employee_id, 'presence', row, function (error) {
                        if (error) {
                            logger.error(error)
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

presence.prototype._onIncomingEmployeeDailyStatsSynchronization = function (employeeId, _stats) {
    instance.latestDailyStats[employeeId] = _stats;
};

presence.prototype._onIncomingEmployeeMonthlyStatsSynchronization = function (employeeId, _stats) {
    instance.latestMonthlyStats[employeeId] = _stats;
};

presence.prototype._onIncomingEmployeeYearlyStatsSynchronization = function (employeeId, _stats) {
    instance.latestYearlyStats[employeeId] = _stats;
};


presence.prototype._generateDailyStats = function (date) {
    instance._findAllEmployees()
        .then(function (employee) {
            return instance._computeEmployeeDailyStats(employee, date)
                .then(function (stats) {
                    return instance._synchronizeEmployeeDailyStats(employee, date, stats);
                });
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeDailyStats = function (employee, date) {
    var _stats = {};

    return instance._computeEmployeeDailyTotalDuration(employee, date)
        .then(function (totalDuration) {
            _stats._total_duration = totalDuration;
            return instance._computeEmployeeDailyStartTime(employee, date);
        }).then(function (startTime) {
            _stats._start_time = startTime;
            return instance._computeEmployeeDailyEndTime(employee, date);
        }).then(function (endTime) {
            _stats._end_time = endTime;
        }).then(function () {
            return _stats;
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeDailyTotalDuration = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findAllByEmployeeIdAndBetweenDates(employee.id, startDate, endDate)
        .then(function (rows) {
            var totalDuration = moment.duration();

            if (rows != undefined) {
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].is_present) {
                        if (i + 1 < rows.length) {
                            var next = rows[i + 1];
                            var diff = moment(next.created_date).diff(moment(rows[i].created_date));
                            totalDuration = totalDuration.add(diff);
                        }
                    } else {

                    }
                }
            }

            return totalDuration.asSeconds();
        });
};

presence.prototype._computeEmployeeDailyStartTime = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findFirstDatePresenceByEmployeeId(employee.id, startDate, endDate)
        .then(function (presence) {
            if (presence !== undefined) {
                return moment(presence.created_date).diff(date.startOf('day'), 'seconds');
            } else {
                return 0;
            }
        });
};

presence.prototype._computeEmployeeDailyEndTime = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findLastDatePresenceByEmployeeId(employee.id, startDate, endDate)
        .then(function (presence) {
            if (presence !== undefined) {
                return moment(presence.created_date).diff(date.startOf('day'), 'seconds');
            } else {
                return 0;
            }
        });
};

presence.prototype._synchronizeEmployeeDailyStats = function (employee, date, stats) {
    this.latestDailyStats[employee.id] = stats;
    return instance.communication.emitAsync('synchronization:outgoing:performance:daily:stats', employee, 'presence', date, stats);
};


presence.prototype._generateMonthlyStats = function (date) {
    instance._findAllEmployees()
        .then(function (employee) {
            var stats = instance._computeEmployeeMonthlyStats(employee, date);
            return instance._synchronizeEmployeeMonthlyStats(employee, date, stats);
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeMonthlyStats = function (employee, date) {
    if (date.date() == 1) { // beginning of the month
        this.latestMonthlyStats[employee.id] = null;
    }

    if (this.latestMonthlyStats[employee.id] === undefined || this.latestMonthlyStats[employee.id] === null) { // no latest monthly stats
        this.latestMonthlyStats[employee.id] = {
            _total_duration_by_day: {},
            _start_time_by_day: {},
            _end_time_by_day: {},

            _total_days: parseInt(moment().endOf('month').format('D')),
            _present_days: 0,

            _average_start_time: 0,

            _average_end_time: 0
        };
    }

    if (this.latestDailyStats[employee.id] === undefined || this.latestDailyStats[employee.id] === null) {
        this.latestDailyStats[employee.id] = {
            _total_duration: 0,
            _start_time: 0,
            _end_time: 0
        };
    }

    var _stats = _.cloneDeep(this.latestMonthlyStats[employee.id]);

    var result = instance._computeEmployeeMonthlyStartTime(employee, date);
    _.extend(_stats._start_time_by_day, result[0]);
    _stats._minimum_start_time = result[1];
    _stats._maximum_start_time = result[2];
    _stats._average_start_time = result[3];

    result = instance._computeEmployeeMonthlyEndTime(employee, date);
    _.extend(_stats._end_time_by_day, result[0]);
    _stats._minimum_end_time = result[1];
    _stats._maximum_end_time = result[2];
    _stats._average_end_time = result[3];

    result = instance._computeEmployeeMonthlyTotalDuration(employee, date);
    _.extend(_stats._total_duration_by_day, result[0]);
    _stats._present_days = result[1];

    return _stats;
};

presence.prototype._computeEmployeeMonthlyStartTime = function (employee, date) {
    var startTimeByDay = {};
    if (this.latestDailyStats[employee.id]._start_time > 0) {
        startTimeByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id]._start_time;
    }

    if (this.latestDailyStats[employee.id]._start_time > 0) {
        var minimumStartTime = _.min([this.latestMonthlyStats[employee.id]._minimum_start_time, this.latestDailyStats[employee.id]._start_time]);
    } else {
        var minimumStartTime = this.latestMonthlyStats[employee.id]._minimum_start_time;
    }

    var maximumStartTime = _.max([this.latestMonthlyStats[employee.id]._maximum_start_time, this.latestDailyStats[employee.id]._start_time]);

    // https://en.wikipedia.org/wiki/Moving_average
    var averageStartTime = (this.latestDailyStats[employee.id]._start_time + this.latestMonthlyStats[employee.id]._present_days * this.latestMonthlyStats[employee.id]._average_start_time) / (this.latestMonthlyStats[employee.id]._present_days + 1);

    return [startTimeByDay, minimumStartTime, maximumStartTime, averageStartTime];
};

presence.prototype._computeEmployeeMonthlyEndTime = function (employee, date) {
    var endTimeByDay = {};
    if (this.latestDailyStats[employee.id]._end_time > 0) {
        endTimeByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id]._end_time;
    }

    if (this.latestDailyStats[employee.id]._end_time > 0) {
        var minimumEndTime = _.min([this.latestMonthlyStats[employee.id]._minimum_end_time, this.latestDailyStats[employee.id]._end_time]);
    } else {
        var minimumEndTime = this.latestMonthlyStats[employee.id]._minimum_end_time;
    }
    var maximumEndTime = _.max([this.latestMonthlyStats[employee.id]._maximum_end_time, this.latestDailyStats[employee.id]._end_time]);

    // https://en.wikipedia.org/wiki/Moving_average
    var averageEndTime = (this.latestDailyStats[employee.id]._end_time + this.latestMonthlyStats[employee.id]._present_days * this.latestMonthlyStats[employee.id]._average_end_time) / (this.latestMonthlyStats[employee.id]._present_days + 1);

    return [endTimeByDay, minimumEndTime, maximumEndTime, averageEndTime];
};

presence.prototype._computeEmployeeMonthlyTotalDuration = function (employee, date) {
    var totalDurationByDay = {};
    if (this.latestDailyStats[employee.id]._total_duration > 0) {
        totalDurationByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id]._total_duration;

        var presentDays = this.latestMonthlyStats[employee.id]._present_days + 1;
    } else {
        var presentDays = this.latestMonthlyStats[employee.id]._present_days;
    }

    return [totalDurationByDay, presentDays];
};

presence.prototype._synchronizeEmployeeMonthlyStats = function (employee, date, stats) {
    this.latestMonthlyStats[employee.id] = stats;
    return instance.communication.emitAsync('synchronization:outgoing:performance:monthly:stats', employee, 'presence', date, stats);
};


presence.prototype._generateYearlyStats = function (date) {
    instance._findAllEmployees()
        .then(function (employee) {
            return instance._computeEmployeeYearlyStats(employee, date)
                .then(function (stats) {
                    return instance._synchronizeEmployeeYearlyStats(employee, date, stats);
                });
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeYearlyStats = function (employee, date) {
    if (date.date() == 1 && date.month() == 0) {
        // beginning of the year
        this.latestYearlyStats = null;
    }
};

presence.prototype._synchronizeEmployeeYearlyStats = function (employee, date, stats) {
    this.latestYearlyStats = stats;
    return instance.communication.emitAsync('synchronization:outgoing:performance:yearly:stats', employee, 'presence', date, stats);
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
    return this.communication.emitAsync('database:person:retrieveOneByOne', 'SELECT * FROM employee;', []);
};

var instance = new presence();

module.exports = instance;

