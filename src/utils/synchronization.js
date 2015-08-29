/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var moment = require('moment');
var Firebase = require('firebase');
var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function synchronization() {
    var dogId = undefined;

    var moduleUpdateCallback;
    var deviceCreateOrUpdateCallback;
    var deviceDeleteCallback;
    var employeeCreateOrUpdateCallback;
    var employeeDeleteCallback;

    var employeePerformancePushCallback;

    var dogRef = undefined;
    var companyRef = undefined;

    var timeout = undefined;
}

synchronization.prototype.start = function (id, callback,
                                            moduleUpdateCallback,
                                            deviceCreateOrUpdateCallback,
                                            deviceDeleteCallback,
                                            employeeCreateOrUpdateCallback,
                                            employeeDeleteCallback,
                                            employeePerformancePushCallback) {
    var self = this;

    this.dogId = id;

    this.moduleUpdateCallback = moduleUpdateCallback;
    this.deviceCreateOrUpdateCallback = deviceCreateOrUpdateCallback;
    this.deviceDeleteCallback = deviceDeleteCallback;
    this.employeeCreateOrUpdateCallback = employeeCreateOrUpdateCallback;
    this.employeeDeleteCallback = employeeDeleteCallback;

    this.employeePerformancePushCallback = employeePerformancePushCallback;

    try {
        this.dogRef = firebase.child('dogs/' + this.dogId);

        this.dogRef.once('value', function (snapshot) {
            var dog = snapshot.val();
            if (dog !== undefined) {

                if (dog.modules !== undefined) {

                    self.dogRef.child('modules').on('child_changed', self._handleModuleUpdate);
                    _.forEach(dog.modules, function (modules, type) {
                        _.forEach(modules, function (moduleConfiguration, moduleName) {
                            moduleUpdateCallback(type, moduleName, moduleConfiguration);
                        });
                    });
                }

                if (dog.company_id !== undefined) {
                    self.companyRef = firebase.child('companies/' + dog.company_id);

                    self.companyRef.child('/devices').on('child_added', self._handleDeviceAdded);
                    self.companyRef.child('/devices').on('child_changed', self._handleDeviceChanged);
                    self.companyRef.child('/devices').on('child_removed', self._handleDeviceRemoved);
                    self.companyRef.child('/employees').on('child_added', self._handleEmployeeAdded);
                    self.companyRef.child('/employees').on('child_changed', self._handleEmployeeChanged);
                    self.companyRef.child('/employees').on('child_removed', self._handleEmployeeRemoved);
                }
            }
        });

        var time = 2 * 60 * 1000;

        function synchronize() {
            try {
                self._synchronize();
            } catch (error) {
                console.error(error.stack);
            }

            self.timeout = setTimeout(synchronize, time * (1 + Math.random()));
        }

        synchronize();

        callback(null);
    } catch (error) {
        callback(error);
    }
};

synchronization.prototype._synchronize = function () {

    this.employeePerformancePushCallback(function (error, employeeId, type, performance, onComplete) {
        if (error) {
            console.error(error);
        } else {
            performance = _.omit(performance, ['id', 'is_synced', 'employee_id']);

            var date = moment(performance.created_date);
            performance.created_date = date.utc().format();

            firebase.child('employee_performances/' + employeeId + '/' + type + '/' + date.format('YYYY/MM/DD')).push(performance, onComplete);
        }
    });
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

synchronization.prototype._handleModuleUpdate = function (snapshot) {
    var modules = snapshot.val();
    var type = snapshot.key();

    _.forEach(modules, function (moduleConfiguration, moduleName) {
        instance.moduleUpdateCallback(type, moduleName, moduleConfiguration);
    });
};

synchronization.prototype._handleDeviceAdded = function (snapshot) {
    var deviceId = snapshot.key();

    firebase.child('devices/' + deviceId).on('value', function (snapshot) {
        instance.deviceCreateOrUpdateCallback(_.extend({id: snapshot.key()}, snapshot.val()));
    });
};

synchronization.prototype._handleDeviceChanged = function (snapshot) {
};

synchronization.prototype._handleDeviceRemoved = function (snapshot) {
};

synchronization.prototype._handleEmployeeAdded = function (snapshot) {
    var employeeId = snapshot.key();

    firebase.child('employees/' + employeeId).on('value', function (snapshot) {
        instance.employeeCreateOrUpdateCallback(_.extend({id: snapshot.key()}, snapshot.val()));
    });
};

synchronization.prototype._handleEmployeeChanged = function (snapshot) {
};

synchronization.prototype._handleEmployeeRemoved = function (snapshot) {
};

var instance = new synchronization();

module.exports = instance;
