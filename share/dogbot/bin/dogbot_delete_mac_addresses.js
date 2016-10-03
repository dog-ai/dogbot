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

function deleteMacAddressByIdAndCompanyId(macAddressId, companyId) {
    return new Promise(function (resolve, reject) {
        firebase.child('company_mac_addresses/' + companyId + '/' + macAddressId).remove(function (error) {
            if (error) {
                reject();
            } else {
                firebase.child('companies/' + companyId + '/mac_addresses/' + macAddressId).remove(function (error) {
                    if (error) {
                        reject();
                    } else {
                        resolve();
                    }
                });
            }
        });

    });
}

function deleteDeviceByIdAndCompanyId(deviceId, companyId) {
    return new Promise(function (resolve, reject) {
        firebase.child('company_devices/' + companyId + '/' + deviceId).remove(function (error) {
            if (error) {
                reject();
            } else {
                firebase.child('companies/' + companyId + '/devices/' + deviceId).remove(function (error) {
                    if (error) {
                        reject();
                    } else {
                        resolve();
                    }
                });
            }
        });

    });
}


firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN, function (error) {
    if (error) {
        throw error;
    } else {
        var companyId = process.argv[2];

        if (companyId) {

            var availableMacAddresses = 0,
                deletedMacAddresses = 0,
                deletedDevices = 0;

            firebase.child('company_mac_addresses/' + companyId).once("value", function (snapshot) {
                var macAddresses = snapshot.val();

                var promises = [];

                _.forEach(macAddresses, function (macAddress, macAddressId) {
                    availableMacAddresses++;

                    if (moment().isSame(moment(macAddress.created_date), 'day')) {
                        promises.push(deleteMacAddressByIdAndCompanyId(macAddressId, companyId)
                            .then(function () {
                                deletedMacAddresses++;

                                if (macAddress.device_id) {
                                    return deleteDeviceByIdAndCompanyId(macAddress.device_id, companyId);
                                }
                            })
                            .then(function () {
                                deletedDevices++;
                            })
                            .catch(function (error) {
                                console.error("Error while deleting mac address " + macAddressId + ": " + error.stack);
                            }));
                    }
                });

                return Promise.all(promises)
                    .then(function () {
                        console.log(
                            "Available mac addresses: " + availableMacAddresses +
                            "\nDeleted mac addresses: " + deletedMacAddresses +
                            "\nDeleted devices: " + deletedDevices
                        );
                    })
                    .catch(function (error) {
                        console.error(error.stack);
                    }).finally(function () {
                        process.exit(0);
                    });


            });
        }
    }
});