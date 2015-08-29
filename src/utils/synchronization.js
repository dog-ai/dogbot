/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var Firebase = require('firebase');
var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function synchronization() {
    var dogId = undefined;

    var dogRef = undefined;
    var companyRef = undefined;

}

synchronization.prototype.start = function (id, callback,
                                            moduleUpdateCallback,
                                            deviceCreateOrUpdateCallback,
                                            deviceDeleteCallback,
                                            employeeCreateOrUpdateCallback,
                                            employeeDeleteCallback) {
    var self = this;

    this.dogId = id;

    function handleModuleUpdate(snapshot) {
        var modules = snapshot.val();
        var type = snapshot.key();

        _.forEach(modules, function (moduleConfiguration, moduleName) {
            moduleUpdateCallback(type, moduleName, moduleConfiguration);
        });
    }

    function handleDeviceAdded(snapshot) {
        var deviceId = snapshot.key();

        firebase.child('devices/' + deviceId).on('value', function (snapshot) {
            deviceCreateOrUpdateCallback(_.extend({id: snapshot.key()}, snapshot.val()));
        });
    }

    function handleDeviceChanged(snapshot) {
    }

    function handleDeviceRemoved(snapshot) {
    }

    function handleEmployeeAdded(snapshot) {
        var employeeId = snapshot.key();

        firebase.child('employees/' + employeeId).on('value', function (snapshot) {
            employeeCreateOrUpdateCallback(_.extend({id: snapshot.key()}, snapshot.val()));
        });
    }

    function handleEmployeeChanged(snapshot) {
    }

    function handleEmployeeRemoved(snapshot) {
    }

    try {
        this.dogRef = firebase.child('dogs/' + this.dogId);

        this.dogRef.once('value', function (snapshot) {
            var dog = snapshot.val();
            if (dog !== undefined) {

                if (dog.modules !== undefined) {

                    self.dogRef.child('modules').on('child_changed', handleModuleUpdate);
                    _.forEach(dog.modules, function (modules, type) {
                        _.forEach(modules, function (moduleConfiguration, moduleName) {
                            moduleUpdateCallback(type, moduleName, moduleConfiguration);
                        });
                    });
                }

                if (dog.company_id !== undefined) {
                    self.companyRef = firebase.child('companies/' + dog.company_id);

                    self.companyRef.child('/devices').on('child_added', handleDeviceAdded);
                    self.companyRef.child('/devices').on('child_changed', handleDeviceChanged);
                    self.companyRef.child('/devices').on('child_removed', handleDeviceRemoved);
                    self.companyRef.child('/employees').on('child_added', handleEmployeeAdded);
                    self.companyRef.child('/employees').on('child_changed', handleEmployeeChanged);
                    self.companyRef.child('/employees').on('child_removed', handleEmployeeRemoved);
                }
            }
        });

        callback(null);
    } catch (error) {
        callback(error);
    }
};

synchronization.prototype.stop = function () {
    this.dogId = undefined;

    if (this.dogRef !== undefined && this.dogRef !== null) {
        //this.dogRef.off('value');
        this.dogRef = undefined;
    }

    if (this.companyRef !== undefined && this.companyRef !== null) {
        this.companyRef.child('/devices').off('child_added');
        this.companyRef.child('/devices').off('child_changed');
        this.companyRef.child('/devices').off('child_removed');
        this.companyRef.child('/devices').once('value', function (snapshot) {
            snapshot.forEach(function (snapshot) {
                firebase.child('devices/' + snapshot.key()).off('value');
            });
        });
        this.companyRef.child('/employees').off('child_added');
        this.companyRef.child('/employees').off('child_changed');
        this.companyRef.child('/employees').off('child_removed');
        this.companyRef.child('/employees').once('value', function (snapshot) {
            snapshot.forEach(function (snapshot) {
                firebase.child('employees/' + snapshot.key()).off('value');
            });
        });

        this.companyRef = undefined;
    }
};

module.exports = new synchronization();
