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

var _ = require('lodash');

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN, function (error) {
    if (error) {
        throw error;
    } else {
        var companyId = process.argv[2];

        firebase.child('companies/' + companyId + '/mac_addresses').once("value", function (snapshot) {
            var val = snapshot.val();

            _.forEach(val, function (val, key) {
                firebase.child('mac_addresses/' + key).once('value', function (snapshot) {
                    var val = snapshot.val();

                    if (val === undefined || val === null) {
                        return;
                    }

                    firebase.child('company_mac_addresses/' + companyId + '/' + key).set(val, function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            firebase.child('mac_addresses/' + key).remove();
                            console.log('Moved ' + 'mac_addresses/' + key + ' to ' + 'company_mac_addresses/' + companyId + '/' + key);
                        }
                    });
                });
            });
        });

        firebase.child('companies/' + companyId + '/devices').once("value", function (snapshot) {
            var val = snapshot.val();

            _.forEach(val, function (val, key) {
                firebase.child('devices/' + key).once('value', function (snapshot) {
                    var val = snapshot.val();

                    if (val === undefined || val === null) {
                        return;
                    }

                    firebase.child('company_devices/' + companyId + '/' + key).set(val, function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            firebase.child('devices/' + key).remove();
                            console.log('Moved ' + 'devices/' + key + ' to ' + 'company_devices/' + companyId + '/' + key);
                        }
                    });
                });
            });
        });

        firebase.child('companies/' + companyId + '/employees').once("value", function (snapshot) {
            var val = snapshot.val();

            _.forEach(val, function (val, key) {
                firebase.child('employees/' + key).once('value', function (snapshot) {
                    var val = snapshot.val();

                    if (val === undefined || val === null) {
                        return;
                    }

                    firebase.child('company_employees/' + companyId + '/' + key).set(val, function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            firebase.child('employees/' + key).remove();
                            console.log('Moved ' + 'employees/' + key + ' to ' + 'company_employees/' + companyId + '/' + key);
                        }
                    });
                });

                firebase.child('employee_performances/' + key).once('value', function (snapshot) {
                    var val = snapshot.val();

                    if (val === undefined || val === null) {
                        return;
                    }

                    firebase.child('company_employee_performances/' + companyId + '/' + key).set(val, function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            firebase.child('employee_performances/' + key).remove();
                            console.log('Moved ' + 'employee_performances/' + key + ' to ' + 'company_employee_performances/' + companyId + '/' + key);
                        }
                    });
                });
            });
        });
    }
});