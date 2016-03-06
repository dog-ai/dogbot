/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

process.on('exit', function() {
});

process.on('uncaughtException', function(exception) {
    console.error(exception.stack);
    process.exit(-1);
});


var FIREBASE_ENDPOINT = 'https://dazzling-torch-7723.firebaseIO.com';
var FIREBASE_SECRET = 'XRslnfTztm7ItZ7LELZhCB3IoS20WNekEH6inN0g';
var FIREBASE_CUSTOM_USER_ADMIN_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhZG1pbiI6dHJ1ZSwiZXhwIjo0NTk3MDY0NTMwLCJ2IjowLCJkIjp7InVpZCI6ImRlMWYwNzcwLTVlYzItMTFlNS04OTUyLTE1MjZmMmQwN2U2NSJ9LCJpYXQiOjE0NDI2NjI2NzR9.6nT37WTuJ1-6Rl3z_D0CZMNCmP9uvK9M98O8yfHEIBQ';

var uuid = require('node-uuid');
var Firebase = require('firebase');
var firebase = new Firebase(FIREBASE_ENDPOINT);
var FirebaseTokenGenerator = require('firebase-token-generator');
var firebaseTokenGenerator = new FirebaseTokenGenerator(FIREBASE_SECRET);
var moment = require('moment');

firebase.authWithCustomToken(FIREBASE_CUSTOM_USER_ADMIN_TOKEN, function (error) {
    if (error) {
        throw error;
    } else {
        console.log('Generating dogbot secret...');

        // NOTE: http://stackoverflow.com/questions/20342058/which-uuid-version-to-use
        var uid = uuid.v1();

        var expirationDate = 4597064530; // Wed, 04 Sep 2115 18:22:10 GMT (100 years!)
        var firebaseToken = firebaseTokenGenerator.createToken(
            {uid: uid},
            {expires: expirationDate}
        );
        
        console.log('Creating dogbot...');
        
        firebase.child('dogs/' + uid).set({
            created_date: moment().format(),
            updated_date: moment().format(),
            modules: {
                monitor: {
                  arp: {
                    is_enabled : true
                  },
                  ip : {
                    is_enabled : true
                  }
                },
                performance : {
                  presence : {
                    is_enabled : true
                  }
                },
                person : {
                  device : {
                    is_enabled : true
                  },
                  employee : {
                    is_enabled : true
                  },
                  mac_address : {
                    is_enabled : true
                  },
                  notification : {
                    is_enabled : true
                  }
                }
              },
        }, function (error) {
            if (error) {
                throw error;
            } else {
                console.log('Done!\nHere is your dogbot secret: ' + firebaseToken);
                
                process.exit(0);
            }
        });
    }
});