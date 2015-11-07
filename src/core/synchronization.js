/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js');

var _ = require('lodash');
var moment = require('moment-timezone');
var Firebase = require('firebase');
var firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com');

function synchronization() {
}

synchronization.prototype.start = function (token, callback,
                                            onModuleUpdatedCallback,
                                            onMacAddressCreatedOrUpdatedCallback,
                                            onMacAddressDeletedCallback,
                                            onDeviceCreatedOrUpdatedCallback,
                                            onDeviceDeletedCallback,
                                            onEmployeeCreatedOrUpdatedCallback,
                                            onEmployeeDeletedCallback,

                                            onMacAddressPush,
                                            onPerformancePush,

                                            onPerformancePull,
                                            onPerformanceStatsPull,

                                            updateDevice,
                                            updateEmployee,
                                            updateEmployeePerformanceStats,
                                            synchronize) {
    var self = this;

    this.onModuleUpdatedCallback = onModuleUpdatedCallback;
    this.onDeviceCreatedOrUpdatedCallback = onDeviceCreatedOrUpdatedCallback;
    this.onDeviceDeletedCallback = onDeviceDeletedCallback;
    this.onEmployeeCreatedOrUpdatedCallback = onEmployeeCreatedOrUpdatedCallback;
    this.onEmployeeDeletedCallback = onEmployeeDeletedCallback;

    this.onMacAddressPush = onMacAddressPush;
    this.onMacAddressCreatedOrUpdatedCallback = onMacAddressCreatedOrUpdatedCallback;
    this.onMacAddressDeletedCallback = onMacAddressDeletedCallback;

    this.onPerformancePush = onPerformancePush;
    this.onPerformancePull = onPerformancePull;
    this.onPerformanceStatsPull = onPerformanceStatsPull;

    updateDevice(this._updateDevice);
    updateEmployee(this._updateEmployee);
    updateEmployeePerformanceStats(
        this._updateEmployeePerformanceDailyStats,
        this._updateEmployeePerformanceMonthlyStats,
        this._updateEmployeePerformanceYearlyStats,
        this._updateEmployeePerformanceAlltimeStats
    );

    firebase.authWithCustomToken(token, function (error, authData) {
        if (error) {
            callback(error);
        } else {
            logger.info('Synchronizing as %s', authData.uid);

            self.dogId = authData.uid;

            self._init(callback);
        }
    });

    synchronize(this._synchronize);
};

synchronization.prototype.stop = function (callback) {
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

    if (callback !== undefined) {
        callback();
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
                    logger.error(error.stack);
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
                    logger.error("devices child_added" + error);
                });
                self.companyRef.child('/devices').on('child_removed', self._onCompanyDeviceRemoved, function (error) {
                    logger.error("devices child_removed" + error);
                });

                // listen for company employee events
                self.companyRef.child('/employees').on('child_added', self._onCompanyEmployeeAdded, function (error) {
                    logger.error("employees child_added" + error);
                });
                self.companyRef.child('/employees').on('child_removed', self._onCompanyEmployeeRemoved, function (error) {
                    logger.error("employees child_removed" + error);
                });

                // listen for company devices events
                self.companyRef.child('/mac_addresses').on('child_added', self._onCompanyMacAddressAdded, function (error) {
                    logger.error("mac addresses child_added" + error);
                });
                self.companyRef.child('/mac_addresses').on('child_removed', self._onCompanyMacAddressRemoved, function (error) {
                    logger.error("mac addresses child_removed" + error);
                });
            }
        }

        callback(null, self.dogId);

    }, function (error) {
        callback(error);
    });
};

synchronization.prototype._synchronize = function (callback) {

    if (instance.companyRef !== undefined && instance.companyRef !== null) {

        instance.onMacAddressPush(function (error, mac_address, onComplete) {
            if (error) {
                logger.error(error.stack);
            } else {

                logger.debug('sending mac address: %s', JSON.stringify(mac_address));

                if (mac_address.is_to_be_deleted) {
                    instance.companyRef.child('mac_addresses/' + mac_address.id).remove(function (error) {
                        if (error) {
                            logger.error(error);
                        } else {
                            var macAddressRef = firebase.child('mac_addresses/' + mac_address.id);
                            macAddressRef.remove(function (error) {
                                onComplete(error, mac_address);
                            });
                        }
                    });


                } else {
                    var val = _.omit(mac_address, ['id', 'is_synced', 'is_present', 'is_to_be_deleted']);
                    val = _.extend(val, {company_id: instance.companyId});
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
                                logger.error(error);
                            } else {
                                instance.companyRef.child('mac_addresses/' + macAddressRef.key()).set(true, function (error) {
                                    mac_address.id = macAddressRef.key();
                                    onComplete(error, mac_address);
                                });
                            }
                        });
                    }
                }
            }
        });

        var performanceNames = ['presence'];
        _.forEach(performanceNames, function (performanceName) {
            instance.onPerformancePush(performanceName, function (error, employeeId, type, performance, onComplete) {
                if (error) {
                    logger.error(error.stack);
                } else {

                    logger.debug('sending performance ' + performanceName + ': %s', JSON.stringify(performance));

                    performance = _.omit(performance, ['id', 'is_synced', 'employee_id']);

                    var date = moment(performance.created_date);
                    performance.created_date = date.format();

                    firebase.child('employee_performances/' + employeeId + '/' + type + '/' + date.format('YYYY/MM/DD')).push(performance, onComplete);
                }
            });

        });

        var now = moment().format();
        instance.dogRef.update({
            last_seen_date: now,
            updated_date: now
        });
    }

    callback();
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
        logger.error("mac address " + error);
    });
};

synchronization.prototype._onCompanyMacAddressRemoved = function (snapshot) {
    var macAddressId = snapshot.key();

    logger.debug('deleted mac address: %s', macAddressId);

    firebase.child('mac_addresses/' + macAddressId).off('value');
    instance.onMacAddressDeletedCallback({id: macAddressId});
};

synchronization.prototype._onMacAddressChanged = function (snapshot) {
    var mac_address = snapshot.val();

    logger.debug('received mac address: %s', JSON.stringify(mac_address));

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
        logger.error("device " + error);
    });
};

synchronization.prototype._onCompanyDeviceRemoved = function (snapshot) {
    var deviceId = snapshot.key();

    logger.debug('deleted device: %s', deviceId);

    firebase.child('devices/' + deviceId).off('value');
    instance.onDeviceDeletedCallback({id: deviceId});
};

synchronization.prototype._onDeviceChanged = function (snapshot) {
    var device = snapshot.val();

    if (device !== null) {
        logger.debug('received device: %s', JSON.stringify(device));

        if (device.created_date !== undefined && device.created_date !== null) {
            device.created_date = new Date(device.created_date);
        }
        if (device.updated_date !== undefined && device.updated_date !== null) {
            device.updated_date = new Date(device.updated_date);
        }

        instance.onDeviceCreatedOrUpdatedCallback(_.extend({id: snapshot.key()}, device));
    }
};



synchronization.prototype._onCompanyEmployeeAdded = function (snapshot) {
    var employeeId = snapshot.key();

    firebase.child('employees/' + employeeId).on('value', instance._onEmployeeChanged, function (error) {
        logger.error("employee " + error);
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
        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.subtract(1, 'day').format('YYYY/MM/DD') + '/_stats').once('value', function (snapshot) {
            var _stats = snapshot.val();
            if (_stats !== null) {
                instance.onPerformanceStatsPull(performanceName, 'daily', employeeId, _stats);
            }
        });
        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.format('YYYY/MM') + '/_stats').once('value', function (snapshot) {
            var _stats = snapshot.val();
            if (_stats === null) {
                firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.subtract(1, 'month').format('YYYY/MM') + '/_stats').once('value', function (snapshot) {
                    var _stats = snapshot.val();
                    if (_stats !== null) {
                        instance.onPerformanceStatsPull(performanceName, 'monthly', employeeId, _stats);
                    }
                });

            } else {
                instance.onPerformanceStatsPull(performanceName, 'monthly', employeeId, _stats);
            }
        });
        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.format('YYYY') + '/_stats').once('value', function (snapshot) {
            var _stats = snapshot.val();
            if (_stats === null) {
                firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/' + today.subtract(1, 'year').format('YYYY') + '/_stats').once('value', function (snapshot) {
                    var _stats = snapshot.val();
                    if (_stats !== null) {
                        instance.onPerformanceStatsPull(performanceName, 'yearly', employeeId, _stats);
                    }
                });
            } else {
                instance.onPerformanceStatsPull(performanceName, 'yearly', employeeId, _stats);
            }
        });
        firebase.child('employee_performances/' + employeeId + '/' + performanceName + '/_stats').once('value', function (snapshot) {
            var _stats = snapshot.val();
            if (_stats !== null) {
                instance.onPerformanceStatsPull(performanceName, 'alltime', employeeId, _stats);
            }
        });
    });
};

synchronization.prototype._onCompanyEmployeeRemoved = function (snapshot) {
    var employeeId = snapshot.key();

    logger.debug('deleted employee: %s', employeeId);

    firebase.child('employees/' + employeeId).off('value');
    instance.onEmployeeDeletedCallback({id: employeeId});
};

synchronization.prototype._onEmployeeChanged = function (snapshot) {
    var employee = snapshot.val();

    if (employee !== null) {
        logger.debug('received employee: %s', JSON.stringify(employee));

        if (employee.created_date !== undefined && employee.created_date !== null) {
            employee.created_date = new Date(employee.created_date);
        }
        if (employee.updated_date !== undefined && employee.updated_date !== null) {
            employee.updated_date = new Date(employee.updated_date);
        }

        instance.onEmployeeCreatedOrUpdatedCallback(_.extend({id: snapshot.key()}, employee));
    }
};


synchronization.prototype._updateDevice = function (device) {
    logger.debug('sending device: %s', JSON.stringify(device));

    firebase.child('devices/' + device.id).update({
        updated_date: moment().format(),
        is_present: device.is_present
    }, function (error) {
        if (error) {
            logger.error(error.stack);
        }
    });
};

synchronization.prototype._updateEmployee = function (employee) {
    logger.debug('sending employee: %s', JSON.stringify(employee));

    firebase.child('employees/' + employee.id).update({
        updated_date: moment().format(),
        is_present: employee.is_present
    }, function (error) {
        if (error) {
            logger.error(error.stack);
        }
    });
};


synchronization.prototype._updateEmployeePerformanceDailyStats = function (employee, performanceName, date, stats, callback) {
    logger.debug('sending employee performance daily stats: %s', JSON.stringify(stats));

    firebase.child('employee_performances/' + employee.id + '/' + performanceName + '/' + date.format('YYYY/MM/DD') + '/_stats')
        .update(stats, function (error) {
            if (callback !== undefined && callback !== null) {
                callback(error);
            }
        });
};

synchronization.prototype._updateEmployeePerformanceMonthlyStats = function (employee, performanceName, date, stats, callback) {
    logger.debug('sending employee performance monthly stats: %s', JSON.stringify(stats));

    firebase.child('employee_performances/' + employee.id + '/' + performanceName + '/' + date.format('YYYY/MM') + '/_stats')
        .update(stats, function (error) {
            if (callback !== undefined && callback !== null) {
                callback(error);
            }
        });
};

synchronization.prototype._updateEmployeePerformanceYearlyStats = function (employee, performanceName, date, stats, callback) {
    logger.debug('sending employee performance yearly stats: %s', JSON.stringify(stats));

    firebase.child('employee_performances/' + employee.id + '/' + performanceName + '/' + date.format('YYYY') + '/_stats')
        .update(stats, function (error) {
            if (callback !== undefined && callback !== null) {
                callback(error);
            }
        });
};

synchronization.prototype._updateEmployeePerformanceAlltimeStats = function (employee, performanceName, stats, callback) {
    logger.debug('sending employee performance alltime stats: %s', JSON.stringify(stats));

    firebase.child('employee_performances/' + employee.id + '/' + performanceName + '/_stats')
        .update(stats, function (error) {
            if (callback !== undefined && callback !== null) {
                callback(error);
            }
        });
};


var instance = new synchronization();

module.exports = instance;
