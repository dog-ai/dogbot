/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

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

var sqlDatabasePerformance = require('../../../src/databases/sql/performance'),
    performancePresence = require('../../../src/modules/performance/presence'),
    communication = require('../../../src/utils/communication');

sqlDatabasePerformance.start(communication);
performancePresence.load(communication);

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
        firebase.child('company_employee_performances/' + companyId + '/' + employeeId + '/' + performanceName)
            .once("value", function (snapshot) {
                var val = snapshot.val();

                for (year in val) {
                    if (year.indexOf('_') == 0) {
                        delete val[year]
                    }

                    for (month in val[year]) {
                        if (month.indexOf('_') == 0) {
                            delete val[year][month]
                        }

                        for (day in val[year][month]) {
                            if (day.indexOf('_') == 0) {
                                delete val[year][month][day]
                            }

                            for (presence in val[year][month][day]) {
                                if (presence.indexOf('_') == 0) {
                                    delete val[year][month][day][presence];
                                }
                            }
                        }
                    }
                }

                resolve(val);
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

var _deleteCompanyEmployeePerformanceSample = function (companyId, employeeId, performanceName, year, month, day, sampleId) {
    console.log('Deleting sample at company_employee_performances/' + companyId + '/' + employeeId + '/' + performanceName + '/' + year + '/' + month + '/' + day + '/' + sampleId);

    return new Promise(function (resolve, reject) {
        firebase.child(
                'company_employee_performances/' +
                companyId + '/' +
                employeeId + '/' +
                performanceName + '/' +
                year + '/' +
                month + '/' +
                day + '/' +
                sampleId)
            .set(null, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
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

                    return communication.emitAsync('database:performance:delete', 'DELETE FROM ' + performanceName, [])
                        .then(function () {

                            var promises = [];

                          var previousSample = undefined;

                          var years = _.sortBy(_.keys(performance))
                          _.forEach(years, function (year) {

                            var months = _.sortBy(_.keys(performance[year]))
                            _.forEach(months, function (month) {

                              var days = _.sortBy(_.keys(performance[year][month]))
                              _.forEach(days, function (day) {

                                console.log('Importing employee ' + employeeId + ' ' + performanceName + ' stats with date ' + year + '/' + month + '/' + day);

                                var samples = performance[year][month][day];
                                        _.forEach(samples, function (sample, sampleId) {

                                            sample.employee_id = employeeId;
                                            sample.created_date = moment(sample.created_date).toDate();
                                          sample.is_synced = true;

                                          if (previousSample && !moment(sample.created_date).isAfter(moment(previousSample.created_date))) {
                                            console.log('Found created_date inconsistency');
                                            promises.push(_deleteCompanyEmployeePerformanceSample(this.companyId, employeeId, performanceName, year, month, day, sampleId));

                                          } else if (previousSample && sample.is_present == previousSample.is_present) {
                                            console.log('Found is_present inconsistency');
                                            return _deleteCompanyEmployeePerformanceSample(this.companyId, employeeId, performanceName, year, month, day, sampleId)
                                          } else {
                                                promises.push(performancePresence._createPresence(sample)
                                                    .catch(function () {
                                                      console.log('Found duplicate');
                                                      return _deleteCompanyEmployeePerformanceSample(this.companyId, employeeId, performanceName, year, month, day, sampleId)
                                                    })
                                                );

                                            previousSample = _.clone(sample);
                                            }
                                        });
                                    });
                                });
                            });

                            return Promise.all(promises);
                        });
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