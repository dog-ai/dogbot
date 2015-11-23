/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment'),
    later = require('later'),
    Promise = require("bluebird")

    ;

later.date.localTime();

function presence() {
    this.communication = undefined;

    this.latestDailyStats = {};
    this.latestMonthlyStats = {};
    this.latestYearlyStats = {};
    this.latestAlltimeStats = {};
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
    this.communication.on('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.on('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.on('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.on('person:employee:nearby', this._onEmployeePresence);
    this.communication.on('person:employee:faraway', this._onEmployeePresence);
    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);

    this.communication.emit('worker:job:enqueue', 'performance:presence:daily:stats', null, '01 00 00 * * *');
    this.communication.emit('worker:job:enqueue', 'performance:presence:monthly:stats', null, '02 00 00 * * *');
    this.communication.emit('worker:job:enqueue', 'performance:presence:alltime:stats', null, '03 00 00 * * *');
};

presence.prototype.stop = function () {
    this.communication.removeListener('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.removeListener('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.removeListener('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.removeListener('person:employee:nearby', this._onEmployeePresence);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresence);
    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);
};


presence.prototype._onEmployeePresence = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id).then(function (performance) {
        if (performance && performance.is_present == employee.is_present) {
            return;
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

presence.prototype._onIncomingEmployeeAlltimeStatsSynchronization = function (employeeId, _stats) {
    instance.latestAlltimeStats[employeeId] = _stats;
};


presence.prototype._generateDailyStats = function (params, callback) {
    var date = moment().subtract(1, 'day');
    instance._findAllEmployees()
        .then(function (employees) {
            var promises = [];
            _.forEach(employees, function (employee) {
                promises.push(instance._computeEmployeeDailyStats(employee, date).then(function (stats) {
                    return instance._synchronizeEmployeeDailyStats(employee, date, stats);
                }));
            });
            return Promise.all(promises);
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

presence.prototype._computeEmployeeDailyStats = function (employee, date) {
    var _stats = {};

    return instance._computeEmployeeDailyTotalDuration(employee, date)
        .then(function (totalDuration) {
            _stats.total_duration = totalDuration;
            return instance._computeEmployeeDailyStartTime(employee, date);
        }).then(function (startTime) {
            _stats.start_time = startTime;
            return instance._computeEmployeeDailyEndTime(employee, date);
        }).then(function (endTime) {
            _stats.end_time = endTime;
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


presence.prototype._generateMonthlyStats = function (params, callback) {
    var date = moment().subtract(1, 'day');
    instance._findAllEmployees()
        .then(function (employees) {
            var promises = [];
            _.forEach(employees, function (employee) {
                try {
                    var stats = instance._computeEmployeeMonthlyStats(employee, date);
                    promises.push(instance._synchronizeEmployeeMonthlyStats(employee, date, stats));
                } catch (error) {
                }
            });

            return Promise.all(promises);
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

presence.prototype._computeEmployeeMonthlyStats = function (employee, date) {
    if (date.date() == 1) { // beginning of the month
        this.latestMonthlyStats[employee.id] = null;
    }

    if (this.latestMonthlyStats[employee.id] === undefined || this.latestMonthlyStats[employee.id] === null) { // no latest monthly stats
        this.latestMonthlyStats[employee.id] = {
            total_duration_by_day: {},
            start_time_by_day: {},
            end_time_by_day: {},

            total_days: parseInt(date.clone().endOf('month').format('D')),
            present_days: 0,

            average_total_duration: 0,
            average_start_time: 0,
            average_end_time: 0,

            maximum_total_duration: 0,
            maximum_start_time: 0,
            maximum_end_time: 0,

            minimum_total_duration: 0,
            minimum_start_time: 0,
            minimum_end_time: 0
        };
    }

    if (this.latestDailyStats[employee.id] === undefined || this.latestDailyStats[employee.id] === null) { // no latest daily stats
        this.latestDailyStats[employee.id] = {
            total_duration: 0,
            start_time: 0,
            end_time: 0
        };
    }

    var _stats = _.cloneDeep(this.latestMonthlyStats[employee.id]);

    try {
        var result = instance._computeEmployeeMonthlyStartTime(employee, date);
        _.extend(_stats.start_time_by_day, result[0]);
        _stats.minimum_start_time = result[1];
        _stats.maximum_start_time = result[2];
        _stats.average_start_time = result[3];

        result = instance._computeEmployeeMonthlyEndTime(employee, date);
        _.extend(_stats.end_time_by_day, result[0]);
        _stats.minimum_end_time = result[1];
        _stats.maximum_end_time = result[2];
        _stats.average_end_time = result[3];

        result = instance._computeEmployeeMonthlyTotalDuration(employee, date);
        _.extend(_stats.total_duration_by_day, result[0]);
        _stats.minimum_total_duration = result[1];
        _stats.maximum_total_duration = result[2];
        _stats.average_total_duration = result[3];
        _stats.present_days = result[4];

    } catch (error) {
        throw new Error('unable to compute employee monthly stats');
    }

    return _stats;
};

presence.prototype._computeEmployeeMonthlyStartTime = function (employee, date) {
    if (this.latestDailyStats[employee.id].start_time === undefined || this.latestDailyStats[employee.id].start_time == 0) {
        throw new Error('unable to compute employee monthly start time');
    }

    var startTimeByDay = {};
    startTimeByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id].start_time;
    if (this.latestMonthlyStats[employee.id].minimum_start_time == 0) {
        var minimumStartTime = this.latestDailyStats[employee.id].start_time;
    } else {
        minimumStartTime = _.min([this.latestMonthlyStats[employee.id].minimum_start_time, this.latestDailyStats[employee.id].start_time]);
    }
    var maximumStartTime = _.max([this.latestMonthlyStats[employee.id].maximum_start_time, this.latestDailyStats[employee.id].start_time]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageStartTime = (this.latestDailyStats[employee.id].start_time + this.latestMonthlyStats[employee.id].present_days * this.latestMonthlyStats[employee.id].average_start_time) / (this.latestMonthlyStats[employee.id].present_days + 1);

    return [startTimeByDay, minimumStartTime, maximumStartTime, averageStartTime];
};

presence.prototype._computeEmployeeMonthlyEndTime = function (employee, date) {
    if (this.latestDailyStats[employee.id].end_time === undefined || this.latestDailyStats[employee.id].end_time == 0) {
        throw new Error('unable to compute employee monthly end time');
    }

    var endTimeByDay = {};
    endTimeByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id].end_time;
    if (this.latestMonthlyStats[employee.id].minimum_end_time == 0) {
        var minimumEndTime = this.latestDailyStats[employee.id].end_time;
    } else {
        minimumEndTime = _.min([this.latestMonthlyStats[employee.id].minimum_end_time, this.latestDailyStats[employee.id].end_time]);
    }
    var maximumEndTime = _.max([this.latestMonthlyStats[employee.id].maximum_end_time, this.latestDailyStats[employee.id].end_time]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageEndTime = (this.latestDailyStats[employee.id].end_time + this.latestMonthlyStats[employee.id].present_days * this.latestMonthlyStats[employee.id].average_end_time) / (this.latestMonthlyStats[employee.id].present_days + 1);

    return [endTimeByDay, minimumEndTime, maximumEndTime, averageEndTime];
};

presence.prototype._computeEmployeeMonthlyTotalDuration = function (employee, date) {
    if (this.latestDailyStats[employee.id].total_duration === undefined || this.latestDailyStats[employee.id].total_duration == 0) {
        throw new Error('unable to compute employee monthly total duration');
    }

    var totalDurationByDay = {};
    totalDurationByDay[date.startOf('day').unix()] = this.latestDailyStats[employee.id].total_duration;

    var presentDays = this.latestMonthlyStats[employee.id].present_days + 1;
    if (this.latestMonthlyStats[employee.id].minimum_total_duration == 0) {
        var minimumTotalDuration = this.latestDailyStats[employee.id].total_duration;
    } else {
        minimumTotalDuration = _.min([this.latestMonthlyStats[employee.id].minimum_total_duration, this.latestDailyStats[employee.id].total_duration]);
    }
    var maximumTotalDuration = _.max([this.latestMonthlyStats[employee.id].maximum_total_duration, this.latestDailyStats[employee.id].total_duration]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageTotalDuration = (this.latestDailyStats[employee.id].total_duration + this.latestMonthlyStats[employee.id].present_days * this.latestMonthlyStats[employee.id].average_total_duration) / (this.latestMonthlyStats[employee.id].present_days + 1);

    return [totalDurationByDay, minimumTotalDuration, maximumTotalDuration, averageTotalDuration, presentDays];
};

presence.prototype._synchronizeEmployeeMonthlyStats = function (employee, date, stats) {
    this.latestMonthlyStats[employee.id] = stats;
    return instance.communication.emitAsync('synchronization:outgoing:performance:monthly:stats', employee, 'presence', date, stats);
};


presence.prototype._generateYearlyStats = function (params, callback) {
    instance._findAllEmployees()
        .then(function (employee) {
            return instance._computeEmployeeYearlyStats(employee, date)
                .then(function (stats) {
                    return instance._synchronizeEmployeeYearlyStats(employee, date, stats);
                });
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
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


presence.prototype._generateAlltimeStats = function (params, callback) {
    var date = moment().subtract(1, 'day');
    instance._findAllEmployees()
        .then(function (employees) {
            var promises = [];
            _.forEach(employees, function (employee) {
                try {
                    var stats = instance._computeEmployeeAlltimeStats(employee, date);
                    promises.push(instance._synchronizeEmployeeAlltimeStats(employee, stats));
                } catch (error) {
                }
            });

            return Promise.all(promises);
        })
        .then(function () {
            callback();
        })
        .catch(function (error) {
            callback(error);
        });
};

presence.prototype._computeEmployeeAlltimeStats = function (employee, date) {
    var now = moment().format();
    if (this.latestAlltimeStats[employee.id] === undefined || this.latestAlltimeStats[employee.id] === null) { // no latest alltime stats
        this.latestAlltimeStats[employee.id] = {
            created_date: now,
            started_date: date.format(),

            present_days: 0,

            average_total_duration: 0,
            average_start_time: 0,
            average_end_time: 0,

            previous_average_total_duration: 0,
            previous_average_start_time: 0,
            previous_average_end_time: 0,

            maximum_total_duration: 0,
            maximum_start_time: 0,
            maximum_end_time: 0,

            minimum_total_duration: 0,
            minimum_start_time: 0,
            minimum_end_time: 0,
        };
    } else {
        this.latestAlltimeStats[employee.id].updated_date = now;
        this.latestAlltimeStats[employee.id].ended_date = date.clone().endOf('day').format();
    }

    if (this.latestDailyStats[employee.id] === undefined || this.latestDailyStats[employee.id] === null) { // no latest daily stats
        this.latestDailyStats[employee.id] = {
            total_duration: 0,
            start_time: 0,
            end_time: 0
        };
    }

    var _stats = _.cloneDeep(this.latestAlltimeStats[employee.id]);

    try {
        var result = instance._computeEmployeeAlltimeStartTime(employee);
        _stats.minimum_start_time = result[0];
        _stats.maximum_start_time = result[1];
        _stats.average_start_time = result[2];
        _stats.previous_average_start_time = result[3];

        result = instance._computeEmployeeAlltimeEndTime(employee);
        _stats.minimum_end_time = result[0];
        _stats.maximum_end_time = result[1];
        _stats.average_end_time = result[2];
        _stats.previous_average_end_time = result[3];

        result = instance._computeEmployeeAlltimeTotalDuration(employee);
        _stats.minimum_total_duration = result[0];
        _stats.maximum_total_duration = result[1];
        _stats.average_total_duration = result[2];
        _stats.previous_average_total_duration = result[3];
        _stats.present_days = result[4];
    } catch (error) {
        throw new Error('unable to compute employee alltime stats');
    }

    return _stats;
};

presence.prototype._computeEmployeeAlltimeStartTime = function (employee) {
    if (this.latestDailyStats[employee.id].start_time === undefined || this.latestDailyStats[employee.id].start_time == 0) {
        throw new Error('unable to compute employee alltime start time');
    }

    if (this.latestAlltimeStats[employee.id].minimum_start_time == 0) {
        var minimumStartTime = this.latestDailyStats[employee.id].start_time;
    } else {
        minimumStartTime = _.min([this.latestAlltimeStats[employee.id].minimum_start_time, this.latestDailyStats[employee.id].start_time]);
    }
    var maximumStartTime = _.max([this.latestAlltimeStats[employee.id].maximum_start_time, this.latestDailyStats[employee.id].start_time]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageStartTime = (this.latestDailyStats[employee.id].start_time + this.latestAlltimeStats[employee.id].present_days * this.latestAlltimeStats[employee.id].average_start_time) / (this.latestAlltimeStats[employee.id].present_days + 1);

    return [minimumStartTime, maximumStartTime, averageStartTime, this.latestAlltimeStats[employee.id].average_start_time];
};

presence.prototype._computeEmployeeAlltimeEndTime = function (employee) {
    if (this.latestDailyStats[employee.id].end_time === undefined || this.latestDailyStats[employee.id].end_time == 0) {
        throw new Error('unable to compute employee alltime end time');
    }

    if (this.latestAlltimeStats[employee.id].minimum_end_time == 0) {
        var minimumEndTime = this.latestDailyStats[employee.id].end_time;
    } else {
        minimumEndTime = _.min([this.latestAlltimeStats[employee.id].minimum_end_time, this.latestDailyStats[employee.id].end_time]);
    }
    var maximumEndTime = _.max([this.latestAlltimeStats[employee.id].maximum_end_time, this.latestDailyStats[employee.id].end_time]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageEndTime = (this.latestDailyStats[employee.id].end_time + this.latestAlltimeStats[employee.id].present_days * this.latestAlltimeStats[employee.id].average_end_time) / (this.latestAlltimeStats[employee.id].present_days + 1);

    return [minimumEndTime, maximumEndTime, averageEndTime, this.latestAlltimeStats[employee.id].average_end_time];
};

presence.prototype._computeEmployeeAlltimeTotalDuration = function (employee) {
    if (this.latestDailyStats[employee.id].end_time === undefined || this.latestDailyStats[employee.id].end_time == 0) {
        throw new Error('unable to compute employee monthly total duration');
    }

    var presentDays = this.latestAlltimeStats[employee.id].present_days + 1;
    if (this.latestAlltimeStats[employee.id].minimum_total_duration == 0) {
        var minimumTotalDuration = this.latestDailyStats[employee.id].total_duration;
    } else {
        minimumTotalDuration = _.min([this.latestAlltimeStats[employee.id].minimum_total_duration, this.latestDailyStats[employee.id].total_duration]);
    }
    var maximumTotalDuration = _.max([this.latestAlltimeStats[employee.id].maximum_total_duration, this.latestDailyStats[employee.id].total_duration]);
    // https://en.wikipedia.org/wiki/Moving_average
    var averageTotalDuration = (this.latestDailyStats[employee.id].total_duration + this.latestAlltimeStats[employee.id].present_days * this.latestAlltimeStats[employee.id].average_total_duration) / (this.latestAlltimeStats[employee.id].present_days + 1);

    return [minimumTotalDuration, maximumTotalDuration, averageTotalDuration, this.latestAlltimeStats[employee.id].average_total_duration, presentDays];
};

presence.prototype._synchronizeEmployeeAlltimeStats = function (employee, stats) {
    this.latestAlltimeStats[employee.id] = stats;
    return instance.communication.emitAsync('synchronization:outgoing:performance:alltime:stats', employee, 'presence', stats);
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

