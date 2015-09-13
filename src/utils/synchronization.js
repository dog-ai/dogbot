/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var debug = require('debug')('dogbot:synchronization');
debug.log = console.info.bind(console);

var _ = require('lodash');
var moment = require('moment-timezone');
var Firebase = require('firebase');
var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function synchronization() {
    var dogId = undefined;
    var dogRef = undefined;

    var companyId = undefined;
    var companyRef = undefined;

    var timeout = undefined;
}

synchronization.prototype.start = function (token, callback,
                                            onModuleUpdatedCallback,
                                            onMacAddressCreatedOrUpdateCallback,
                                            onMacAddressDeletedCallback,
                                            onDeviceCreatedOrUpdatedCallback,
                                            onDeviceDeletedCallback,
                                            onEmployeeCreatedOrUpdatedCallback,
                                            onEmployeeDeletedCallback,

                                            onMacAddressPush,

                                            onPerformancePush,
                                            onPerformancePull,
                                            updateDevice,
                                            updateEmployee) {
    var self = this;

    this.onModuleUpdatedCallback = onModuleUpdatedCallback;
    this.onDeviceCreatedOrUpdatedCallback = onDeviceCreatedOrUpdatedCallback;
    this.onDeviceDeletedCallback = onDeviceDeletedCallback;
    this.onEmployeeCreatedOrUpdatedCallback = onEmployeeCreatedOrUpdatedCallback;
    this.onEmployeeDeletedCallback = onEmployeeDeletedCallback;

    this.onMacAddressPush = onMacAddressPush;
    this.onMacAddressCreatedOrUpdatedCallback = onMacAddressCreatedOrUpdateCallback;
    this.onMacAddressDeletedCallback = onMacAddressDeletedCallback;

    this.onPerformancePush = onPerformancePush;
    this.onPerformancePull = onPerformancePull;

    updateDevice(this._updateDevice);
    updateEmployee(this._updateEmployee);

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

    if (this.timeout !== undefined && this.timeout !== null) {
        clearTimeout(this.timeout);
    }
};

synchronization.prototype._init = function (callback) {
    var self = this;

    this.dogRef = firebase.child('dogs/' + this.dogId);

    this.dogRef.once('value', function (snapshot) {
        var dog = snapshot.val();
        if (dog !== undefined) {

            if (dog.timezone !== undefined && dog.timezone !== null) {
                moment.tz.setDefault(dog.timezone);
            }

            var now = moment().format();
            self.dogRef.update({
                last_seen_date: now,
                updated_date: now
            });

            // listen for dog modules events
            if (dog.modules !== undefined) {
                self.dogRef.child('modules').on('child_changed', self._onModuleChanged, function (error) {
                    console.error(error.stack);
                });
                _.forEach(dog.modules, function (modules, type) {
                    _.forEach(modules, function (moduleConfiguration, moduleName) {
                        self.onModuleUpdatedCallback(type, moduleName, moduleConfiguration);
                    });
                });
            }

            if (dog.company_id !== undefined) {
                self.companyId = dog.company_id;
                self.companyRef = firebase.child('companies/' + dog.company_id);

                // listen for company device events
                self.companyRef.child('/devices').on('child_added', self._onCompanyDeviceAdded, function (error) {
                    console.error("devices child_added" + error);
                });
                self.companyRef.child('/devices').on('child_removed', self._onCompanyDeviceRemoved, function (error) {
                    console.error("devices child_removed" + error);
                });

                // listen for company employee events
                self.companyRef.child('/employees').on('child_added', self._onCompanyEmployeeAdded, function (error) {
                    console.error("employees child_added" + error);
                });
                self.companyRef.child('/employees').on('child_removed', self._onCompanyEmployeeRemoved, function (error) {
                    console.error("employees child_removed" + error);
                });

                // listen for company devices events
                self.companyRef.child('/mac_addresses').on('child_added', self._onCompanyMacAddressAdded, function (error) {
                    console.error("mac addresses child_added" + error);
                });
                self.companyRef.child('/mac_addresses').on('child_removed', self._onCompanyMacAddressRemoved, function (error) {
                    console.error("mac addresses child_removed" + error);
                });
            }
        }

        var time = 10 * 60 * 1000;

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

    }, function (error) {
        callback(error);
    });
};

synchronization.prototype._synchronize = function () {
    var self = this;

    if (this.companyRef !== undefined && this.companyRef !== null) {

        this.onMacAddressPush(function (error, mac_address, onComplete) {

            debug('sending mac address: %s', JSON.stringify(mac_address));

            if (error) {
                console.error(error.stack);
            } else {

                var val = _.omit(mac_address, ['id', 'is_synced', 'is_present']);
                val = _.extend(val, {company_id: self.companyId});
                val.created_date = moment(val.created_date).format();
                val.updated_date = moment(val.updated_date).format();
                val.last_presence_date = moment(val.last_presence_date).format();

                var macAddressRef;
                if (mac_address.id !== undefined && mac_address.id !== null) {
                    macAddressRef = firebase.child('mac_addresses/' + mac_address.id);
                    macAddressRef.update(val, function (error) {
                        onComplete(error, mac_address);
                    });
                } else {
                    var macAddressesRef = firebase.child('mac_addresses');
                    macAddressRef = macAddressesRef.push(val, function (error) {
                        if (error) {
                            console.error(error);
                        } else {
                            self.companyRef.child('mac_addresses/' + macAddressRef.key()).set(true, function (error) {
                                mac_address.id = macAddressRef.key();
                                onComplete(error, mac_address);
                            });
                        }
                    });
                }
            }
        });

        this.onPerformancePush(function (error, employeeId, type, performance, onComplete) {
            if (error) {
                console.error(error.stack);
            } else {

                performance = _.omit(performance, ['id', 'is_synced', 'employee_id']);

                var date = moment(performance.created_date);
                performance.created_date = date.format();

                firebase.child('employee_performances/' + employeeId + '/' + type + '/' + date.format('YYYY/MM/DD')).push(performance, onComplete);
            }
        });

        var now = moment().format();
        self.dogRef.update({
            last_seen_date: now,
            updated_date: now
        });
    }
};


synchronization.prototype._onModuleChanged = function (snapshot) {
    var modules = snapshot.val();
    var type = snapshot.key();

    _.forEach(modules, function (moduleConfiguration, moduleName) {
        instance.onModuleUpdatedCallback(type, moduleName, moduleConfiguration);
    });
};


synchronization.prototype._onCompanyMacAddressAdded = function (snapshot) {
    var macAddressId = snapshot.key();

    // listen for mac address events
    firebase.child('mac_addresses/' + macAddressId).on('value', instance._onMacAddressChanged, function (error) {
        console.error("mac address " + error);
    });
};

synchronization.prototype._onCompanyMacAddressRemoved = function (snapshot) {
};

synchronization.prototype._onMacAddressChanged = function (snapshot) {
    var mac_address = snapshot.val();

    debug('received mac address: %s', JSON.stringify(mac_address));

    if (mac_address !== null) {
        if (mac_address.created_date !== undefined && mac_address.created_date !== null) {
            mac_address.created_date = new Date(mac_address.created_date);
        }

        if (mac_address.updated_date !== undefined && mac_address.updated_date !== null) {
            mac_address.updated_date = new Date(mac_address.updated_date);
        }

        if (mac_address.last_presence_date !== undefined && mac_address.last_presence_date !== null) {
            mac_address.last_presence_date = new Date(mac_address.last_presence_date);
        }

        instance.onMacAddressCreatedOrUpdatedCallback(_.extend({
            id: snapshot.key(),
            is_synced: true
        }, mac_address));
    }

};



synchronization.prototype._onCompanyDeviceAdded = function (snapshot) {
    var deviceId = snapshot.key();

    // listen for device events
    firebase.child('devices/' + deviceId).on('value', instance._onDeviceChanged, function (error) {
        console.error("device " + error);
    });
};

synchronization.prototype._onCompanyDeviceRemoved = function (snapshot) {
};

synchronization.prototype._onDeviceChanged = function (snapshot) {
    var device = snapshot.val();

    debug('received device: %s', JSON.stringify(device));

    if (device.created_date !== undefined && device.created_date !== null) {
        device.created_date = new Date(device.created_date);
    }
    if (device.updated_date !== undefined && device.updated_date !== null) {
        device.updated_date = new Date(device.updated_date);
    }

    instance.onDeviceCreatedOrUpdatedCallback(_.extend({id: snapshot.key()}, device));
};



synchronization.prototype._onCompanyEmployeeAdded = function (snapshot) {
    var employeeId = snapshot.key();

    firebase.child('employees/' + employeeId).on('value', instance._onEmployeeChanged, function (error) {
        console.error("employee " + error);
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

synchronization.prototype._onCompanyEmployeeRemoved = function (snapshot) {
};

synchronization.prototype._onEmployeeChanged = function (snapshot) {
    var employee = snapshot.val();

    debug('received employee: %s', JSON.stringify(employee));

    if (employee.created_date !== undefined && employee.created_date !== null) {
        employee.created_date = new Date(employee.created_date);
    }
    if (employee.updated_date !== undefined && employee.updated_date !== null) {
        employee.updated_date = new Date(employee.updated_date);
    }

    instance.onEmployeeCreatedOrUpdatedCallback(_.extend({id: snapshot.key()}, employee));
};


synchronization.prototype._updateDevice = function (device) {
    debug('sending device: %s', JSON.stringify(device));

    firebase.child('devices/' + device.id).update({
        updated_date: moment().format(),
        is_present: device.is_present
    }, function (error) {
        if (error) {
            console.error(error.stack);
        }
    });
};

synchronization.prototype._updateEmployee = function (employee) {
    debug('sending employee: %s', JSON.stringify(employee));

    firebase.child('employees/' + employee.id).update({
        updated_date: moment().format(),
        is_present: employee.is_present
    }, function (error) {
        if (error) {
            console.error(error.stack);
        }
    });
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
