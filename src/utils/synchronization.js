/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var moment = require('moment-timezone');
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
    var employeePerformancePullCallback;

    var dogRef = undefined;
    var companyRef = undefined;

    var timeout = undefined;
}

synchronization.prototype.start = function (token, callback,
                                            onModuleUpdate,
                                            onDeviceCreateOrUpdate,
                                            onDeviceDelete,
                                            onEmployeeCreateOrUpdate,
                                            onEmployeeDelete,
                                            onPerformancePush,
                                            onPerformancePull,
                                            onDeviceIsPresent,
                                            onEmployeeIsPresent) {
    var self = this;

    this.onModuleUpdate = onModuleUpdate;
    this.onDeviceCreateOrUpdate = onDeviceCreateOrUpdate;
    this.onDeviceDelete = onDeviceDelete;
    this.onEmployeeCreateOrUpdate = onEmployeeCreateOrUpdate;
    this.onEmployeeDelete = onEmployeeDelete;

    this.onPerformancePush = onPerformancePush;
    this.onPerformancePull = onPerformancePull;

    onDeviceIsPresent(this._handleDeviceIsPresent);
    onEmployeeIsPresent(this._handleEmployeeIsPresent);

    firebase.authWithCustomToken(token, function (error, authData) {
        if (error) {
            callback(error);
        } else {
            self.dogId = authData.uid;

            self._init(callback);
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

synchronization.prototype._init = function (callback) {
    var self = this;

    try {
        this.dogRef = firebase.child('dogs/' + this.dogId);

        this.dogRef.once('value', function (snapshot) {
            var dog = snapshot.val();
            if (dog !== undefined) {

                if (dog.timezone !== undefined && dog.timezone !== null) {
                    moment.tz.setDefault(dog.timezone);
                }

                self.dogRef.update({updated_date: moment().format()});

                if (dog.modules !== undefined) {

                    self.dogRef.child('modules').on('child_changed', self._handleModuleUpdate, function (error) {
                        console.error(error);
                    });
                    _.forEach(dog.modules, function (modules, type) {
                        _.forEach(modules, function (moduleConfiguration, moduleName) {
                            self.onModuleUpdate(type, moduleName, moduleConfiguration);
                        });
                    });
                }

                if (dog.company_id !== undefined) {
                    self.companyRef = firebase.child('companies/' + dog.company_id);

                    self.companyRef.child('/devices').on('child_added', self._handleDeviceAdded, function (error) {
                        console.error("devices child_added" + error);
                    });
                    self.companyRef.child('/devices').on('child_changed', self._handleDeviceChanged, function (error) {
                        console.error("devices child_changed" + error);
                    });
                    self.companyRef.child('/devices').on('child_removed', self._handleDeviceRemoved, function (error) {
                        console.error("devices child_removed" + error);
                    });
                    self.companyRef.child('/employees').on('child_added', self._handleEmployeeAdded, function (error) {
                        console.error("employees child_added" + error);
                    });
                    self.companyRef.child('/employees').on('child_changed', self._handleEmployeeChanged, function (error) {
                        console.error("employees child_changed" + error);
                    });
                    self.companyRef.child('/employees').on('child_removed', self._handleEmployeeRemoved, function (error) {
                        console.error("employees child_removed" + error);
                    });
                }
            }
        }, function (error) {
            console.log(error);
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

    this.onPerformancePush(function (error, employeeId, type, performance, onComplete) {
        if (error) {
            console.error(error);
        } else {
            performance = _.omit(performance, ['id', 'is_synced', 'employee_id']);

            var date = moment(performance.created_date);
            performance.created_date = date.format();

            firebase.child('employee_performances/' + employeeId + '/' + type + '/' + date.format('YYYY/MM/DD')).push(performance, onComplete);
        }
    });
};

synchronization.prototype._handleDeviceIsPresent = function (device) {
    firebase.child('devices/' + device.id).update({
        updated_date: moment().format(),
        is_present: device.is_present
    }, function (error) {
        if (error) {
            console.error(error);
        }
    });
};

synchronization.prototype._handleEmployeeIsPresent = function (employee) {
    firebase.child('employees/' + employee.id).update({
        updated_date: moment().format(),
        is_present: employee.is_present
    }, function (error) {
        if (error) {
            console.error(error);
        }
    });
};

synchronization.prototype._handleModuleUpdate = function (snapshot) {
    var modules = snapshot.val();
    var type = snapshot.key();

    _.forEach(modules, function (moduleConfiguration, moduleName) {
        instance.onModuleUpdate(type, moduleName, moduleConfiguration);
    });
};

synchronization.prototype._handleDeviceAdded = function (snapshot) {
    var deviceId = snapshot.key();

    firebase.child('devices/' + deviceId).on('value', function (snapshot) {
        var device = snapshot.val();

        if (device.created_date !== undefined && device.created_date !== null) {
            device.created_date = new Date(device.created_date);
        }
        if (device.updated_date !== undefined && device.updated_date !== null) {
            device.updated_date = new Date(device.updated_date);
        }

        instance.onDeviceCreateOrUpdate(_.extend({id: snapshot.key()}, device));
    });
};

synchronization.prototype._handleDeviceChanged = function (snapshot) {
};

synchronization.prototype._handleDeviceRemoved = function (snapshot) {
};

synchronization.prototype._handleEmployeeAdded = function (snapshot) {
    var employeeId = snapshot.key();

    firebase.child('employees/' + employeeId).on('value', function (snapshot) {
        var employee = snapshot.val();

        if (employee.created_date !== undefined && employee.created_date !== null) {
            employee.created_date = new Date(employee.created_date);
        }
        if (employee.updated_date !== undefined && employee.updated_date !== null) {
            employee.updated_date = new Date(employee.updated_date);
        }

        instance.onEmployeeCreateOrUpdate(_.extend({id: snapshot.key()}, employee));
    });

    var performanceNames = ['presence'];

    var today = moment();
    _.forEach(performanceNames, function (performanceName) {
        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.format('YYYY/MM/DD')).orderByChild('created_date').limitToLast(1).once("value", function (snapshot) {
            if (snapshot.val() === null) {
                firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.subtract(1, 'days').format('YYYY/MM/DD')).orderByChild('created_date').limitToLast(1).once("value", function (snapshot) {
                    if (snapshot.val() === null) {
                        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.subtract(2, 'days').format('YYYY/MM/DD')).orderByChild('created_date').limitToLast(1).once("value", function (snapshot) {
                            if (snapshot.val() === null) {
                                // stop here
                            } else {
                                _.forEach(snapshot.val(), function (performance, id) {
                                    if (performance.created_date !== undefined && performance.created_date !== null) {
                                        performance.created_date = new Date(performance.created_date);
                                    }
                                    instance.onPerformancePull(performanceName, _.extend({
                                        employee_id: employeeId,
                                        is_synced: true
                                    }, performance));
                                })
                            }
                        });
                    } else {
                        _.forEach(snapshot.val(), function (performance, id) {
                            if (performance.created_date !== undefined && performance.created_date !== null) {
                                performance.created_date = new Date(performance.created_date);
                            }
                            instance.onPerformancePull(performanceName, _.extend({
                                employee_id: employeeId,
                                is_synced: true
                            }, performance));
                        })
                    }
                });
            } else {
                _.forEach(snapshot.val(), function (performance, id) {
                    if (performance.created_date !== undefined && performance.created_date !== null) {
                        performance.created_date = new Date(performance.created_date);
                    }
                    instance.onPerformancePull(performanceName, _.extend({
                        employee_id: employeeId,
                        is_synced: true
                    }, performance));
                })
            }
        });
    });
};

synchronization.prototype._handleEmployeeChanged = function (snapshot) {
};

synchronization.prototype._handleEmployeeRemoved = function (snapshot) {
};

synchronization.prototype._createToken = function () {
    var FirebaseTokenGenerator = require("firebase-token-generator");
    var tokenGenerator = new FirebaseTokenGenerator("XRslnfTztm7ItZ7LELZhCB3IoS20WNekEH6inN0g");
    var token = tokenGenerator.createToken(
        {uid: "-JxUwB10Up0dRSKAyFtt"},
        {expires: 4597064530}
    );
    console.log(token);
};

var instance = new synchronization();

module.exports = instance;
