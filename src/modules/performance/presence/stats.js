/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment'),
    later = require('later'),
    Promise = require("bluebird");

later.date.localTime();

module.exports = function (parent, instance) {


    parent.prototype._updateAllEmployeeStatsWithYesterday = function (params, callback) {
        var date = moment().subtract(1, 'day');

        instance._updateAllEmployeeStatsForDate(date)
            .then(function () {
                callback();
            })
            .catch(function (error) {
                logger.error(error.stack);
                callback(error);
            });
    };

    parent.prototype._updateAllEmployeeStatsForDate = function (date) {
        return instance._findAllEmployees()
            .map(function (employee) {
                return instance._updateEmployeeDailyStats(employee, date)
                    .then(function () {
                        return Promise.map(['monthly', 'yearly', 'alltime'], function (period) {
                            return instance._updateEmployeePeriodStats(employee, date, period);
                        });
                    })
                    .catch(function (error) {
                        logger.error(error.stack);
                        });
            });
    };


    parent.prototype._updateEmployeeDailyStats = function (employee, date) {
        var startDate = date.clone().startOf('day').toDate();
        var endDate = date.clone().endOf('day').toDate();

        return instance._findAllByEmployeeIdAndBetweenDates(employee.id, startDate, endDate)
            .then(function (performance) {
                return instance._computeEmployeeDailyStats(employee, date, performance)
            })
            .then(function (stats) {
                stats = _.extend(stats, {is_synced: false, created_date: date.format(), updated_date: date.format()});
                return instance._createOrUpdateStatsByEmployeeId(employee.id, stats, stats.period)
            })
    };

    parent.prototype._computeEmployeeDailyStats = function (employee, date, performance) {
        return Promise.props({
            total_duration: instance._computeEmployeeDailyTotalDuration(date, performance),
            start_time: instance._computeEmployeeDailyStartTime(date, performance),
            end_time: instance._computeEmployeeDailyEndTime(date, performance)
        }).then(function (stats) {
            return _.extend(stats, {period: 'daily'});
        });
    };

    parent.prototype._computeEmployeeDailyTotalDuration = function (date, performance) {
        var totalDuration = moment.duration();

        if (performance) {
            for (var i = 0; i < performance.length; i++) {
                if (performance[i].is_present) {
                    if (i + 1 < performance.length) {
                        var next = performance[i + 1];
                        var diff = moment(next.created_date).diff(moment(performance[i].created_date));
                        totalDuration = totalDuration.add(diff);
                    }
                } else {

                }
            }
        }

        return totalDuration.asSeconds();
    };

    parent.prototype._computeEmployeeDailyStartTime = function (date, performance) {
        if (performance && performance[0]) {
            return moment(performance[0].created_date).diff(date.clone().startOf('day'), 'seconds');
        } else {
            return 0;
        }
    };

    parent.prototype._computeEmployeeDailyEndTime = function (date, performance) {
        if (performance && performance[performance.length - 1]) {
            return moment(performance[performance.length - 1].created_date).diff(date.clone().startOf('day'), 'seconds');
        } else {
            return 0;
        }
    };


    parent.prototype._updateEmployeePeriodStats = function (employee, date, period) {
        Promise.join(instance._findStatsByEmployeeId(employee.id, 'daily'), instance._findStatsByEmployeeId(employee.id, period),
            function (dailyStats, oldStats) {
                return instance._computeEmployeePeriodStats(employee, dailyStats, oldStats, date, period)
                    .then(function (newStats) {
                        if (!_.isEqual(oldStats, newStats)) {
                            return instance._createOrUpdateStatsByEmployeeId(employee.id, _.extend(newStats, {is_synced: false}), period);
                        }
                    });
            });
    };

    parent.prototype._computeEmployeePeriodStats = Promise.method(function (employee, dailyStats, stats, date, period) {
        var now = moment().format();

        switch (period) {
            case 'monthly':
                // are we starting a new month
                if (stats && stats.started_date && !moment(stats.started_date).isSame(date, 'month')) {
                    stats = undefined;
                }
                break;
            case 'yearly':
                // are we starting a new month
                if (stats && stats.started_date && !moment(stats.started_date).isSame(date, 'year')) {
                    stats = undefined;
                }
                break;
        }

        // no stats
        if (!stats) {
            stats = {
                created_date: now,
                started_date: date.format(),
                updated_date: now,
                ended_date: date.clone().endOf('day').format(),

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

            switch (period) {
                case 'monthly':
                    stats.total_duration_by_day = {};
                    stats.start_time_by_day = {};
                    stats.end_time_by_day = {};
                    stats.total_days = parseInt(date.clone().endOf('month').format('D'));
                    break;
                case 'yearly':
                    stats.total_days = parseInt(date.clone().endOf('year').diff(date.clone().startOf('year'), 'days'));
                    break;
            }

        } else {
            stats.updated_date = now;
            stats.ended_date = date.clone().endOf('day').format();
        }

        // no daily stats
        if (!dailyStats) {
            dailyStats = {
                total_duration: 0,
                start_time: 0,
                end_time: 0
            };
        }

        var _stats = _.cloneDeep(stats);

        try {
            var result = instance._computeEmployeePeriodStatsStartTime(employee, dailyStats, stats, date, period);
            _stats.minimum_start_time = result[0];
            _stats.maximum_start_time = result[1];
            _stats.average_start_time = result[2];

            if (period === 'monthly') {
                _.extend(_stats.start_time_by_day, result[3]);
            }

            if (period === 'alltime') {
                _stats.previous_average_start_time = stats.average_start_time;
            }

            result = instance._computeEmployeePeriodStatsEndTime(employee, dailyStats, stats, date, period);
            _stats.minimum_end_time = result[0];
            _stats.maximum_end_time = result[1];
            _stats.average_end_time = result[2];

            if (period === 'monthly') {
                _.extend(_stats.end_time_by_day, result[3]);
            }

            if (period === 'alltime') {
                _stats.previous_average_end_time = stats.average_end_time;
            }

            result = instance._computeEmployeePeriodStatsTotalDuration(employee, dailyStats, stats, date, period);
            _stats.minimum_total_duration = result[0];
            _stats.maximum_total_duration = result[1];
            _stats.average_total_duration = result[2];
            _stats.present_days = result[3];

            if (period === 'monthly') {
                _.extend(_stats.total_duration_by_day, result[4]);
            }

            if (period === 'alltime') {
                _stats.previous_average_total_duration = stats.average_total_duration;
            }

        } catch (error) {
            logger.error(error.stack);
            throw new Error('unable to compute employee monthly stats');
        }

        stats.period = period;

        return _stats;
    });

    parent.prototype._computeEmployeePeriodStatsStartTime = function (employee, dailyStats, stats, date, period) {
        if (!dailyStats || dailyStats.start_time == 0) {
            throw new Error('unable to compute employee start time');
        }

        var startTimeByDay = {};
        startTimeByDay[date.clone().startOf('day').unix()] = dailyStats.start_time;

        if (stats.minimum_start_time == 0) {
            var minimumStartTime = dailyStats.start_time;
        } else {
            minimumStartTime = _.min([stats.minimum_start_time, dailyStats.start_time]);
        }
        var maximumStartTime = _.max([stats.maximum_start_time, dailyStats.start_time]);
        // https://en.wikipedia.org/wiki/Moving_average
        var averageStartTime = (dailyStats.start_time + stats.present_days * stats.average_start_time) / (stats.present_days + 1);

        var stat = [minimumStartTime, maximumStartTime, averageStartTime];

        if (period === 'monthly') {
            stat.push(startTimeByDay);
        }

        return stat;
    };

    parent.prototype._computeEmployeePeriodStatsEndTime = function (employee, dailyStats, stats, date, period) {
        if (!dailyStats.end_time || dailyStats.end_time == 0) {
            throw new Error('unable to compute employee monthly end time');
        }

        var endTimeByDay = {};
        endTimeByDay[date.clone().startOf('day').unix()] = dailyStats.end_time;

        if (stats.minimum_end_time == 0) {
            var minimumEndTime = dailyStats.end_time;
        } else {
            minimumEndTime = _.min([stats.minimum_end_time, dailyStats.end_time]);
        }
        var maximumEndTime = _.max([stats.maximum_end_time, dailyStats.end_time]);
        // https://en.wikipedia.org/wiki/Moving_average
        var averageEndTime = (dailyStats.end_time + stats.present_days * stats.average_end_time) / (stats.present_days + 1);

        var stat = [minimumEndTime, maximumEndTime, averageEndTime];

        if (period === 'monthly') {
            stat.push(endTimeByDay);
        }

        return stat;
    };

    parent.prototype._computeEmployeePeriodStatsTotalDuration = function (employee, dailyStats, stats, date, period) {
        if (!dailyStats.total_duration || dailyStats.total_duration == 0) {
            throw new Error('unable to compute employee total duration');
        }

        var totalDurationByDay = {};
        totalDurationByDay[date.clone().startOf('day').unix()] = dailyStats.total_duration;

        var presentDays = stats.present_days + 1;
        if (stats.minimum_total_duration == 0) {
            var minimumTotalDuration = dailyStats.total_duration;
        } else {
            minimumTotalDuration = _.min([stats.minimum_total_duration, dailyStats.total_duration]);
        }
        var maximumTotalDuration = _.max([stats.maximum_total_duration, dailyStats.total_duration]);
        // https://en.wikipedia.org/wiki/Moving_average
        var averageTotalDuration = (dailyStats.total_duration + stats.present_days * stats.average_total_duration) / (stats.present_days + 1);

        var stat = [minimumTotalDuration, maximumTotalDuration, averageTotalDuration, presentDays];

        if (period === 'monthly') {
            stat.push(totalDurationByDay);
        }

        return stat;
    };
};

