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

function resetCompanyResource(companyId, resource) {
  return firebase.child('company_' + resource +'/' + companyId).once("value")
    .then(function (snapshot) {

      var promises = [];

      snapshot.forEach(function (child) {
        var priority;

        if (child.hasChild('last_presence_date')) {
          var last_presence_date = child.val().last_presence_date;
          priority = -moment(last_presence_date).valueOf();
        } else {
          priority = moment().unix();
        }

        var path = 'companies/' + companyId + '/' + resource + '/' + child.key();
        var promise = firebase.child(path).setPriority(priority)
          .then(function () {
            console.log('Successfully set priority ' + priority + ' to ' + path);
          })
          .catch(function (error) {
            console.error('Failed to set priority ' + priority + ' to ' + path + ' because of ' + error.message);
          });


        promises.push(promise);
      });

      return Promise.all(promises);

    });
}

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN)
  .then(function () {
    var companyId = process.argv[2];

    if (companyId) {

      var resources = ['devices', 'employees'];

      return Promise.mapSeries(resources, function (resource) {
          return resetCompanyResource(companyId, resource)
            .catch(function (error) {
              console.error(error.stack);
            });
        })
        .finally(process.exit);
    }
  });