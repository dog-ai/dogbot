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

function countResources(companyId, companyResource) {
    return new Promise(function (resolve, reject) {
        firebase.child('company_' + companyResource + '/' + companyId).once("value", function (snapshot) {
            var resources = snapshot.val();
            var resourcesCount = resources && _.size(resources) || 0;

            firebase.child('companies/' + companyId + '/' + companyResource).once("value", function (snapshot) {
                var companyResources = snapshot.val();
                var companyResourcesCount = companyResources && _.size(companyResources) || 0;

                if (resourcesCount != companyResourcesCount) {

                    reject(new Error(_.difference(_.keys(resources), _.keys(companyResources))));
                } else {
                    resolve(companyResourcesCount);
                }

            }, reject);
        }, reject);

    });
}

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN, function (error) {
    if (error) {
        throw error;
    } else {
        var companyId = process.argv[2];

        if (companyId) {

            var resources = ['devices', 'employees', 'mac_addresses'];

            var promises = [];

            _.forEach(resources, function (resource) {
                promises.push(countResources(companyId, resource)
                    .then(function (count) {
                        console.log(resource + ': ' + count);
                    })
                    .catch(function (error) {
                        console.error('Resource ' + resource + ' count mismatch: ' + error.message);
                    }));
            });

            return Promise.all(promises)
                .then(function () {
                    process.exit(0);
                })
                .catch(function (error) {
                    console.error(error.stack);
                })
        }
    }
});