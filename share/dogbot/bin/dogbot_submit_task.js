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

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN)
  .then(function () {
    var companyId = process.argv[2];
    var task = process.argv[3];

    if (!companyId) {
      console.error("Missing company ID");

      console.log(process.argv[1] + " <companyId> <task>");
      process.exit(1);
    }

    try {
      task = JSON.parse(task);
    } catch (error) {
      console.error(error.message);

      console.log(process.argv[1] + " <companyId> <task>");
      process.exit(1);
    }

    return firebase.child('companies/' + companyId + '/tasks').push(task);
  })
  .then(process.exit);