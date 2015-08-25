/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var Firebase = require('firebase');
var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function synchronization() {
    var dogRef = undefined;
}

synchronization.prototype.start = function (id, callback, moduleCallback, deviceCallback, employeeCallback) {

    function handle(snapshot) {
        var dog = snapshot.val();
        if (dog !== undefined) {

            if (dog.modules !== undefined) {
                _.forEach(dog.modules, function (modules, type) {
                    _.forEach(modules, function (configuration, module) {
                        moduleCallback(type, module, configuration);
                    });
                });
            }

            if (dog.company_id !== undefined) {

                firebase.child('companies/' + dog.company_id + '/devices').once('value', function (snapshot) {
                    snapshot.forEach(function (snapshot) {
                        firebase.child('devices/' + snapshot.key()).once('value', function (snapshot) {
                            deviceCallback(_.extend({id: snapshot.key()}, snapshot.val()));
                        });
                    });
                });

                firebase.child('companies/' + dog.company_id + '/employees').once('value', function (snapshot) {
                    snapshot.forEach(function (snapshot) {
                        firebase.child('employees/' + snapshot.key()).once('value', function (snapshot) {
                            employeeCallback(_.extend({id: snapshot.key()}, snapshot.val()));
                        });
                    });
                });

            }
        }

    }

    try {
        this.dogRef = firebase.child('dogs/' + id);

        this.dogRef.on('value', function (snapshot) {
            handle(snapshot);
        });

        callback(null);
    } catch (error) {
        callback(error);
    }
};

synchronization.prototype.stop = function () {
    if (this.dogRef !== undefined && this.dogRef !== null) {
        this.dogRef.off('value');
    }
};

module.exports = new synchronization();
