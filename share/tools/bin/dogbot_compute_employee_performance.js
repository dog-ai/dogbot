#!/usr/bin/env node

process.on('exit', function () {
});

process.on('uncaughtException', function (exception) {
    console.error(exception.stack);
    process.exit(-1);
});


var FIREBASE_ENDPOINT = 'https://dazzling-torch-7723.firebaseIO.com';
var FIREBASE_CUSTOM_USER_ADMIN_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhZG1pbiI6dHJ1ZSwiZXhwIjo0NTk3MDY0NTMwLCJ2IjowLCJkIjp7InVpZCI6ImRlMWYwNzcwLTVlYzItMTFlNS04OTUyLTE1MjZmMmQwN2U2NSJ9LCJpYXQiOjE0NDI2NjI2NzR9.6nT37WTuJ1-6Rl3z_D0CZMNCmP9uvK9M98O8yfHEIBQ';

var Firebase = require('firebase');
var firebase = new Firebase(FIREBASE_ENDPOINT);

var _ = require('lodash'),
    moment = require('moment'),
    presence = require('../../../src/modules/performance/presence.js'),
    synchronization = require('../../../src/core/synchronization.js');


var _computeAlltimeStats = function (employeeId, performanceName, alltimePerformance) {
    _.forEach(_.sortBy(_.keys(alltimePerformance)), function (year) {
        if (year.indexOf('_') == '0') {
            return;
        }

        var yearPerformance = alltimePerformance[year];

        _computeYearlyStats(employeeId, performanceName, yearPerformance, year);

        console.log(presence.latestYearlyStats[employeeId]);

    });
};

var _computeYearlyStats = function (employeeId, performanceName, yearPerformance, year) {
    _.forEach(_.sortBy(_.keys(yearPerformance)), function (month) {
        if (month.indexOf('_') == '0') {
            return;
        }

        var monthPerformance = yearPerformance[month];

        _computeMonthlyStats(employeeId, performanceName, monthPerformance, year, month);

        console.log(presence.latestMonthlyStats[employeeId]);

        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + year + '/' + month + '/_stats')
            .set(presence.latestMonthlyStats[employeeId], function (error) {
                if (error) {
                    logger.error(error.stack);
                }

            });

    });
};

var _computeMonthlyStats = function (employeeId, performanceName, monthPerformance, year, month) {
    _.forEach(_.sortBy(_.keys(monthPerformance)), function (day) {
        if (day.indexOf('_') == '0') {
            return;
        }

        var date = moment(year + '/' + month + '/' + day, 'YYYY/MM/DD');

        if (moment().isSame(date, 'day')) {
            return;
        }

        console.log('Computing stats for date: ' + year + '/' + month + '/' + day);

        var dayPerformance = monthPerformance[day];

        _computeDailyStats(employeeId, performanceName, dayPerformance, year, month, day);

        presence.latestDailyStats[employeeId] = null;
        presence.latestDailyStats[employeeId] = dayPerformance['_stats'];

        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + year + '/' + month + '/' + day + '/_stats')
            .set(presence.latestDailyStats[employeeId], function (error) {
                if (error) {
                    logger.error(error.stack);
                }

            });


        try {
            var monthlyStats = presence._computeEmployeeMonthlyStats({id: employeeId}, date);
            presence.latestMonthlyStats[employeeId] = monthlyStats;
        } catch (error) {
        }

        try {
            var alltimeStats = presence._computeEmployeeAlltimeStats({id: employeeId}, date);
            presence.latestAlltimeStats[employeeId] = alltimeStats;
        } catch (error) {
        }
    });
};

var _computeDailyStats = function (employeeId, performanceName, dayPerformance, year, month, day) {

    var date = moment(year + '/' + month + '/' + day, 'YYYY/MM/DD');

    dayPerformance._stats = {};

    var keys = _.filter(_.sortBy(_.keys(dayPerformance)), function (key) {
        return key != '_stats';
    });

    var totalDuration = moment.duration();

    if (keys != undefined) {
        for (var i = 0; i < keys.length; i++) {

            if (dayPerformance[keys[i]].is_present) {
                if (i + 1 < keys.length) {
                    var next = dayPerformance[keys[i + 1]];
                    var diff = moment(next.created_date).diff(moment(dayPerformance[keys[i]].created_date));
                    totalDuration = totalDuration.add(diff);
                }
            } else {

            }
        }

        if (keys.length > 0) {
            dayPerformance._stats.start_time = moment(dayPerformance[keys[0]].created_date).diff(date.startOf('day'), 'seconds');
            dayPerformance._stats.end_time = moment(dayPerformance[keys[keys.length - 1]].created_date).diff(date.startOf('day'), 'seconds');
        } else {
            dayPerformance._stats.start_time = 0;
            dayPerformance._stats.end_time = 0;
        }
    }

    dayPerformance._stats.total_duration = totalDuration.asSeconds();
};

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN, function (error) {
    if (error) {
        throw error;
    } else {
        var employeeId = process.argv[2];
        var performanceName = process.argv[3];

        if (employeeId !== undefined && employeeId !== null && performanceName !== undefined && performanceName !== null) {

            firebase.child('employee_performances/' + employeeId + '/' + performanceName).once("value", function (snapshot) {
                var alltimePerformance = snapshot.val();

                if (alltimePerformance !== null) {

                    _computeAlltimeStats(employeeId, performanceName, alltimePerformance);

                    console.log(presence.latestAlltimeStats[employeeId]);

                    firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/_stats')
                        .set(presence.latestAlltimeStats[employeeId], function (error) {
                            if (error) {
                                logger.error(error.stack);
                            }

                            process.exit(0);
                        });
                }
            });
        }
    }
});