/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var Queue = require('firebase-queue'),
    Firebase = require('firebase');

var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function worker() {
    var queueRef = undefined;
    var queue = undefined;
}

worker.prototype.start = function (dogId) {
    this.queueRef = firebase.child('dogs/' + dogId + '/queue');

    var options = {
        //'specId': 'spec_1',
        //'numWorkers': 5,
        //'sanitize': false,
        //'suppressStack': true
    };

    this.queue = new Queue(this.queueRef, options, function (data, progress, resolve, reject) {
        // Read and process task data
        console.log(data);

        // Do some work
        progress(50);

        // Finish the task asynchronously
        setTimeout(function () {
            resolve();
        }, 10000);
    });

    //this.queueRef.child('tasks').push({'foo': 'bar'});
};

worker.prototype.stop = function (callback) {
    if (this.queue === undefined) {
        callback();
    } else {
        return this.queue.shutdown().then(function () {
            callback();
        });
    }
};

var instance = new worker();

module.exports = instance;