/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment');

function employee() {
}

employee.prototype.type = "PERSON";

employee.prototype.name = "employee";

employee.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

employee.prototype.load = function (communication) {
    instance.communication = communication;

    instance.start();
};

employee.prototype.unload = function () {
    this.stop();
};

employee.prototype.start = function () {
    this.communication.on('person:device:online', this._handleDeviceOnline);
    this.communication.on('person:device:onlineAgain', this._handleDeviceOnlineAgain);
    this.communication.on('person:device:offline', this._handleDeviceOffline);
    this.communication.on('person:device:addedToEmployee', this._onDeviceAddedToEmployee);
    this.communication.on('person:device:removedFromEmployee', this._onDeviceRemovedFromEmployee);
    this.communication.on('person:slack:active', this._handleSlackActive);
    this.communication.on('person:slack:away', this._handleSlackAway);
    this.communication.on('synchronization:incoming:person:employee:createOrUpdate', this._onCreateOrUpdateEmployeeIncomingSynchronization);
    this.communication.on('synchronization:incoming:person:employee:delete', this._onDeleteEmployeeIncomingSynchronization);
    this.communication.on('synchronization:outgoing:person:employee', this._onEmployeeOutgoingSynchronization);
    this.communication.on('person:employee:is_present', this._isPresent);

    this.communication.emitAsync('synchronization:incoming:setup', {
        companyResource: 'employees',
        onCompanyResourceChangedCallback: function (employee) {
            instance.communication.emit('synchronization:incoming:person:employee:createOrUpdate', employee);
        },
        onCompanyResourceRemovedCallback: function (employee) {
            instance.communication.emit('synchronization:incoming:person:employee:delete', employee);
        }
    });

    this.communication.emitAsync('synchronization:outgoing:setup', {
        companyResource: 'employees',
        event: 'synchronization:outgoing:person:employee'
    });
};

employee.prototype.stop = function () {
    this.communication.removeListener('person:device:online', this._handleDeviceOnline);
    this.communication.removeListener('person:device:onlineAgain', this._handleDeviceOnlineAgain);
    this.communication.removeListener('person:device:offline', this._handleDeviceOffline);
    this.communication.removeListener('person:device:addedToEmployee', this._onDeviceAddedToEmployee);
    this.communication.removeListener('person:device:removedFromEmployee', this._onDeviceRemovedFromEmployee);
    this.communication.removeListener('person:slack:active', this._handleSlackActive);
    this.communication.removeListener('person:slack:away', this._handleSlackAway);
    this.communication.removeListener('synchronization:incoming:person:employee:createOrUpdate', this._onCreateOrUpdateEmployeeIncomingSynchronization);
    this.communication.removeListener('synchronization:incoming:person:employee:delete', this._onDeleteEmployeeIncomingSynchronization);
    this.communication.removeListener('synchronization:outgoing:person:employee', this._onEmployeeOutgoingSynchronization);
    this.communication.removeListener('person:employee:is_present', this._isPresent);
};

employee.prototype._handleSlackAway = function (slack) {
    return instance._findByName(slack.name)
        .then(function (employee) {
            instance.communication.emit('person:employee:offline', employee);
        });
};

employee.prototype._handleSlackActive = function (slack) {
    return instance._findByName(slack.name)
        .then(function (employee) {
            if (employee === undefined || employee === null) {
                return instance._addPresence(slack.name, slack.slack_id)
                    .then(function (employee) {
                        self.communication.emit('person:employee:online', employee);
                    });
            } else {
                self.communication.emit('person:employee:online', employee);
            }
        });
};

employee.prototype._handleDeviceOnline = function (device) {
    if (device.employee_id !== undefined && device.employee_id !== null) {

        return instance._findById(device.employee_id)
            .then(function (employee) {
                if (employee !== undefined && !employee.is_present) {
                    employee.updated_date = new Date();
                    employee.is_present = true;
                    employee.last_presence_date = device.last_presence_date;

                    return instance._updateById(employee.id, employee)
                        .then(function () {
                            instance.communication.emit('person:employee:nearby', employee);

                        });
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    }
};

employee.prototype._handleDeviceOnlineAgain = function (device) {
    if (device.employee_id !== undefined && device.employee_id !== null) {

        return instance._findById(device.employee_id)
            .then(function (employee) {
                if (employee !== undefined) {
                    employee.updated_date = new Date();
                    employee.last_presence_date = device.last_presence_date;
                    employee.is_synced = false;
                    return instance._updateById(employee.id, employee);
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    }
};

employee.prototype._handleDeviceOffline = function (device) {

    if (device.employee_id !== undefined && device.employee_id !== null) {

        return instance._findById(device.employee_id)
            .then(function (employee) {

                if (employee !== undefined) {
                    // only emit farway if the employee does not have any other device online
                    return instance._findAllOnlineDevicesByEmployeeId(employee.id)
                        .then(function (devices) {

                            if (devices.length == 0 && employee.is_present) {

                                employee.is_present = false;
                                employee.last_presence_date = device.last_presence_date;

                                return instance._updateById(employee.id, employee)
                                    .then(function () {
                                        instance.communication.emit('person:employee:faraway', employee);
                                    });
                            }
                        });
                }
            })
            .catch(function (error) {
                logger.error(error.stack);
            });
    }
};

employee.prototype._isPresent = function (employee, callback) {
    function handleArpDiscover() {
        instance.communication.removeListener('monitor:arp:discover:finish', handleArpDiscover);

        instance._findDevicesByEmployeeId(employee.id)
            .then(function (devices) {
                if (devices !== undefined) {
                    var device = _.find(devices, {'is_present': true});
                    callback(device !== undefined);
                }
            })
            .catch(function (error) {
                callback(error);
            });
    }

    instance.communication.on('monitor:arp:discover:finish', handleArpDiscover);
};

employee.prototype._onDeviceAddedToEmployee = function (device, employee) {
    return instance._findById(employee.id)
        .then(function (employee) {
            if (device.is_present && employee !== undefined && !employee.is_present) {
                employee.is_present = true;
                employee.last_presence_date = device.last_presence_date;

                return instance._updateById(employee.id, employee).then(function () {
                    instance.communication.emit('person:employee:nearby', employee);

                });
            }
        })
        .catch(function (error) {
            logger.error(error.stack);
        });
};

employee.prototype._onDeviceRemovedFromEmployee = function (device, employee) {
    return instance._findById(employee.id)
        .then(function (employee) {

            if (employee !== undefined) {
                // only emit farway if the employee does not have any other device online
                return instance._findAllOnlineDevicesByEmployeeId(employee.id)
                    .then(function (devices) {

                        if (devices && devices.length == 0 && employee.is_present) {

                            employee.is_present = false;
                            employee.last_presence_date = device.last_presence_date;

                            return instance._updateById(employee.id, employee).then(function () {
                                instance.communication.emit('person:employee:faraway', employee);
                            });
                        }
                    })
            }
        })
        .catch(function (error) {
            logger.error(error.stack);
        });
};

employee.prototype._onCreateOrUpdateEmployeeIncomingSynchronization = function (employee) {
    return instance.communication.emitAsync('database:person:retrieveAll', 'PRAGMA table_info(employee)', [])
        .then(function (rows) {
            employee = _.pick(employee, _.pluck(rows, 'name'));

            return instance._findById(employee.id).then(function (row) {
                if (row !== undefined) {
                    if (moment(employee.updated_date).isAfter(row.updated_date)) {
                        employee = _.omit(employee, 'is_present', 'last_presence_date');

                        return instance._updateById(employee.id, employee);
                    }
                } else {
                    return instance._add(employee);
                }
            });
        })
        .catch(function (error) {
            logger.error(error.stack);
        });
};

employee.prototype._onDeleteEmployeeIncomingSynchronization = function (employee) {
    return instance._findById(employee.id)
        .then(function (employee) {
            if (employee !== undefined) {
                return instance._deleteById(employee.id)
                    .then(function () {
                        if (employee.is_present) {
                            instance.communication.emit('person:employee:faraway', employee);
                        }  
                    });
            }
        })
        .catch(function (error) {
            logger.error(error.stack);
        });
};

employee.prototype._onEmployeeOutgoingSynchronization = function (callback) {
    instance.communication.emit('database:person:retrieveOneByOne', 'SELECT * FROM employee WHERE is_synced = 0', [], function (error, row) {
        if (error) {
            logger.error(error.stack);
        } else {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                row.is_present = row.is_present == 1;

                instance._findDevicesByEmployeeId(row.id)
                    .then(function (devices) {
                        row.devices = {};

                        _.forEach(devices, function (device) {
                            row.devices[device.id] = true;
                        });

                        callback(null, row, function (error) {
                            if (error) {
                                logger.error(error.stack)
                            } else {
                                delete row.devices;

                                row.is_synced = true;

                                instance._updateById(row.id, row)
                                    .catch(function (error) {
                                        logger.error(error.stack);
                                    });
                            }
                        });
                    });
            }
        }
    });
};

employee.prototype._findDevicesByEmployeeId = function (id) {
    return instance.communication.emitAsync('database:person:retrieveAll', "SELECT * FROM device WHERE employee_id = ?;", [id])
        .then(function (rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                });
            }

            return rows;
        });
};

employee.prototype._addPresence = function (name, slackId) {
    return instance.communication.emitAsync('database:person:create',
        "INSERT INTO employee (name, slack_id) VALUES (?, ?);", [
            name,
            slackId
        ]);
};

employee.prototype._findById = function (id) {
    return instance.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM employee WHERE id = ?;", [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }
            }

            return row;
        });
};

employee.prototype._findByName = function (name) {
    return instance.communication.emitAsync('database:person:retrieveOne', "SELECT * FROM employee WHERE name LIKE ?;", [name])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                }
            }

            return row;
        });
};

employee.prototype._findAllOnlineDevicesByEmployeeId = function (id) {
    return instance.communication.emitAsync('database:person:retrieveAll', 'SELECT * FROM device WHERE employee_id = ? AND is_present = 1;', [id])
        .then(function (rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                });
            }

            return rows;
        });
};

employee.prototype._add = function (employee) {
    var _employee = _.clone(employee);

    if (_employee.created_date !== undefined && _employee.created_date !== null && _employee.created_date instanceof Date) {
        _employee.created_date = _employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_employee.updated_date !== undefined && _employee.updated_date !== null && _employee.updated_date instanceof Date) {
        _employee.updated_date = _employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_employee.last_presence_date !== undefined && _employee.last_presence_date !== null && _employee.last_presence_date instanceof Date) {
        _employee.last_presence_date = _employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_employee);
    var values = _.values(_employee);

    return instance.communication.emitAsync('database:person:create',
        'INSERT INTO employee (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values);
};

employee.prototype._updateById = function (id, employee) {
    var _employee = _.clone(employee);

    if (_employee.created_date !== undefined && _employee.created_date !== null && _employee.created_date instanceof Date) {
        _employee.created_date = _employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_employee.updated_date !== undefined && _employee.updated_date !== null && _employee.updated_date instanceof Date) {
        _employee.updated_date = _employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (_employee.last_presence_date !== undefined && _employee.last_presence_date !== null && _employee.last_presence_date instanceof Date) {
        _employee.last_presence_date = _employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(_employee);
    var values = _.values(_employee);

    return instance.communication.emitAsync('database:person:update',
        'UPDATE employee SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values);
};

employee.prototype._deleteById = function (id) {
    return instance.communication.emitAsync('database:person:delete', 'DELETE FROM employee WHERE id = ?;', [id]);
};

var instance = new employee();

module.exports = instance;
