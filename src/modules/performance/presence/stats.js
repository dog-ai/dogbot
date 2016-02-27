/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment'),
    later = require('later'),
    Promise = require("bluebird")
    ;

later.date.localTime();

module.exports = function (parent, instance) {

    instance.latestDailyStats = {};
    instance.latestMonthlyStats = {};
    instance.latestYearlyStats = {};
    instance.latestAlltimeStats = {};

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

    parent.prototype._onEmployeePresence = function (employee) {
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

    parent.prototype._onIncomingEmployeeDailyStatsSynchronization = function (employee, _stats) {
        instance.latestDailyStats[employee.id] = _stats;
    };

    parent.prototype._onIncomingEmployeeMonthlyStatsSynchronization = function (employee, _stats) {
        instance.latestMonthlyStats[employee.id] = _stats;
    };

    parent.prototype._onIncomingEmployeeYearlyStatsSynchronization = function (employee, _stats) {
        instance.latestYearlyStats[employee.id] = _stats;
    };

    parent.prototype._onIncomingEmployeeAlltimeStatsSynchronization = function (employee, _stats) {
        instance.latestAlltimeStats[employee.id] = _stats;
    };


    parent.prototype._generateDailyStats = function (params, callback) {
        var date = moment().subtract(1, 'day');
        instance._findAllEmployees()
            .then(function (employees) {
                var promises = [];
                _.forEach(employees, function (employee) {
                    promises.push(instance._computeEmployeeDailyStats(employee, date));
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

    parent.prototype._computeEmployeeDailyStats = function (employee, date) {
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
                _stats.period = 'daily';
                return _stats;
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    };

    parent.prototype._computeEmployeeDailyTotalDuration = function (employee, date) {
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

    parent.prototype._computeEmployeeDailyStartTime = function (employee, date) {
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

    parent.prototype._computeEmployeeDailyEndTime = function (employee, date) {
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

    parent.prototype._synchronizeEmployeeDailyStats = function (employee, date, stats) {
        this.latestDailyStats[employee.id] = stats;
        return instance.communication.emitAsync('synchronization:outgoing:performance:daily:stats', employee, 'presence', date, stats);
    };


    parent.prototype._generateMonthlyStats = function (params, callback) {
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

    parent.prototype._computeEmployeeMonthlyStats = function (employee, date) {

        if (this.latestMonthlyStats[employee.id] !== undefined && this.latestMonthlyStats[employee.id] !== null &&
            this.latestMonthlyStats[employee.id].total_duration_by_day !== undefined && _.keys(this.latestMonthlyStats[employee.id].total_duration_by_day).length > 0 && !moment.unix(_.keys(this.latestMonthlyStats[employee.id].total_duration_by_day)[0]).isSame(date, 'month')
        ) { // new month
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

        _stats.period = 'monthly';
        return _stats;
    };

    parent.prototype._computeEmployeeMonthlyStartTime = function (employee, date) {
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

    parent.prototype._computeEmployeeMonthlyEndTime = function (employee, date) {
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

    parent.prototype._computeEmployeeMonthlyTotalDuration = function (employee, date) {
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

    parent.prototype._synchronizeEmployeeMonthlyStats = function (employee, date, stats) {
        this.latestMonthlyStats[employee.id] = stats;
        return instance.communication.emitAsync('synchronization:outgoing:performance:monthly:stats', employee, 'presence', date, stats);
    };


    parent.prototype._generateYearlyStats = function (params, callback) {
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

    parent.prototype._computeEmployeeYearlyStats = function (employee, date) {
        if (date.date() == 1 && date.month() == 0) {
            // beginning of the year
            this.latestYearlyStats = null;
        }
    };

    parent.prototype._synchronizeEmployeeYearlyStats = function (employee, date, stats) {
        this.latestYearlyStats = stats;
        return instance.communication.emitAsync('synchronization:outgoing:performance:yearly:stats', employee, 'presence', date, stats);
    };


    parent.prototype._generateAlltimeStats = function (params, callback) {
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

    parent.prototype._computeEmployeeAlltimeStats = function (employee, date) {
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

        _stats.period = 'alltime';
        return _stats;
    };

    parent.prototype._computeEmployeeAlltimeStartTime = function (employee) {
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

    parent.prototype._computeEmployeeAlltimeEndTime = function (employee) {
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

    parent.prototype._computeEmployeeAlltimeTotalDuration = function (employee) {
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

    parent.prototype._synchronizeEmployeeAlltimeStats = function (employee, stats) {
        this.latestAlltimeStats[employee.id] = stats;
        return instance.communication.emitAsync('synchronization:outgoing:performance:alltime:stats', employee, 'presence', stats);
    };


};

