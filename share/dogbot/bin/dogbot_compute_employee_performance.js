/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

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
    Promise = require('bluebird');

var mkdirSync = require("fs").mkdirSync,
    readFile = Promise.promisify(require("fs").readFile),
    writeFile = Promise.promisify(require('fs').writeFile);

var performancePresenceFn = function () {
};
var performancePresence = new performancePresenceFn();
require('../../../src/modules/performance/presence/stats')(performancePresenceFn, performancePresence);

var synchronization = require('../../../src/bot/synchronization');

var _computeAlltimeStats = function (companyId, employeeId, performanceName, performance) {

    var alltimeStats = undefined;

    return Promise.mapSeries(_.sortBy(_.keys(performance)), function (year) {
        if (year.indexOf('_') == '0') {
            return;
        }

        var yearPerformance = performance[year];

        return _computeYearlyStats(companyId, employeeId, performanceName, yearPerformance, year, alltimeStats).bind(this);
    })
};

var _computeYearlyStats = function (companyId, employeeId, performanceName, yearPerformance, year, alltimeStats) {

    var yearStats = undefined;

    return Promise.mapSeries(_.sortBy(_.keys(yearPerformance)), function (month) {
        if (month.indexOf('_') == '0') {
            return;
        }

        var monthPerformance = yearPerformance[month];

        return _computeMonthlyStats(companyId, employeeId, performanceName, monthPerformance, year, month, alltimeStats).bind(this);
    })
};

var _computeMonthlyStats = function (companyId, employeeId, performanceName, monthPerformance, year, month, alltimeStats) {

    var monthStats = undefined;

    return Promise.mapSeries(_.sortBy(_.keys(monthPerformance)), function (day) {

            if (day.indexOf('_') == '0') {
                return;
            }

            var date = moment(year + '/' + month + '/' + day, 'YYYY/MM/DD');

            if (moment().isSame(date, 'day')) {
                return;
            }

            console.log('Updating employee ' + employeeId + ' ' + performanceName + ' stats with date: ' + year + '/' + month + '/' + day);

            var dayPerformance = monthPerformance[day];

            return _computeDailyStats(companyId, employeeId, performanceName, dayPerformance, year, month, day)
                .then(function (dayStats) {
                    return Promise.props({
                        monthStats: performancePresence._computeEmployeePeriodStats({id: employeeId}, dayStats, monthStats, date, 'monthly'),
                        yearStats: performancePresence._computeEmployeePeriodStats({id: employeeId}, dayStats, this.yearStats, date, 'yearly'),
                        alltimeStats: performancePresence._computeEmployeePeriodStats({id: employeeId}, dayStats, this.alltimeStats, date, 'alltime')
                    });
                })
                .then(function (result) {
                    monthStats = result.monthStats;
                    this.yearStats = result.yearStats;
                    this.alltimeStats = result.alltimeStats;
                })

        })
        .then(function () {
            monthStats = _.omit(monthStats, 'period');

            return new Promise(function (resolve, reject) {
                firebase.child(
                        'company_employee_performances/' +
                        companyId + '/' +
                        employeeId + '/' +
                        performanceName + '/' +
                        year + '/' +
                        month + '/_stats')
                    .set(monthStats, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
            });

        })
        .then(function () {
            this.yearStats = _.omit(this.yearStats, 'period');

            return new Promise(function (resolve, reject) {
                firebase.child(
                        'company_employee_performances/' +
                        companyId + '/' +
                        employeeId + '/' +
                        performanceName + '/' +
                        year + '/_stats')
                    .set(this.yearStats, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
            });

        })
        .then(function () {
            this.alltimeStats = _.omit(this.alltimeStats, 'period');

            return new Promise(function (resolve, reject) {
                firebase.child(
                        'company_employee_performances/' +
                        companyId + '/' +
                        employeeId + '/' +
                        performanceName + '/_stats')
                    .set(this.alltimeStats, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
            });

        });
};

var _computeDailyStats = function (companyId, employeeId, performanceName, dayPerformance, year, month, day) {

    var date = moment(year + '/' + month + '/' + day, 'YYYY/MM/DD');

    return performancePresence._computeEmployeeDailyStats({id: employeeId}, date, _.map(dayPerformance))
        .delay(100)
        .then(function (dayStats) {
            dayStats = _.omit(dayStats, 'period');

            return new Promise(function (resolve, reject) {
                firebase.child(
                        'company_employee_performances/' +
                        companyId + '/' +
                        employeeId + '/' +
                        performanceName + '/' +
                        year + '/' +
                        month + '/' +
                        day + '/_stats')
                    .set(dayStats, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
            })
                .then(function () {
                    return dayStats;
                });

        });
};

var _retrieveCompanyEmployees = function (companyId) {
    return new Promise(function (resolve, reject) {
        firebase.child('companies/' + companyId + '/employees').once("value", function (snapshot) {
            resolve(_.map(snapshot.val(), function (v, k) {
                return k;
            }));
        }, reject);
    });
};

var _retrieveCompanyEmployeePerformance = function (companyId, employeeId, performanceName) {
    return new Promise(function (resolve, reject) {
        firebase.child('company_employee_performances/' + companyId + '/' + employeeId + '/' + performanceName).once("value", function (snapshot) {
            resolve(snapshot.val());
        }, reject);
    });
};

var _readCacheOrRetrieveCompanyEmployeePerformance = function (companyId, employeeId, performanceName) {
    var file = '.cache/company_employee_performances-' + companyId + '-' + employeeId + '-' + performanceName + '.js';

    return readFile(file, "utf8")
        .then(function (cache) {
            return JSON.parse(cache);
        }).catch(function () {
            return _retrieveCompanyEmployeePerformance(companyId, employeeId, performanceName)
                .then(function (performance) {
                    try {
                        mkdirSync('.cache');
                    } catch (ignored) {
                    }

                    return writeFile(file, JSON.stringify(performance), {})
                        .then(function () {
                            return performance;
                        })
                });
        });
};

var _authWithCustomTokenAsync = function (token) {
    return new Promise(function (resolve, reject) {
        firebase.authWithCustomToken(token, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

_authWithCustomTokenAsync(FIREBASE_CUSTOM_USER_ADMIN_TOKEN)
    .then(function () {
        this.companyId = process.argv[2];

        if (!this.companyId) {
            throw new Error('company id is required');
        }

        return this.companyId;
    })
    .then(_retrieveCompanyEmployees)
    .mapSeries(function (employeeId) {
        return Promise.mapSeries(['presence'], function (performanceName) {
            return _readCacheOrRetrieveCompanyEmployeePerformance(this.companyId, employeeId, performanceName)
                .then(function (performance) {
                    return _computeAlltimeStats(this.companyId, employeeId, performanceName, performance);
                });
        });
    })

    .then(function () {
        process.exit(0);
    })
    .catch(function (error) {
        console.error(error.message);
        process.exit(1);
    });