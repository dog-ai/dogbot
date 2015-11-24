/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

var _ = require('lodash');
var moment = require('moment');

function employee() {
    var moduleManager = {};
}

employee.prototype.type = "PERSON";

employee.prototype.name = "employee";

employee.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

employee.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

employee.prototype.unload = function () {
    this.stop();
};

employee.prototype.start = function () {
    this.moduleManager.on('person:device:online', this._handleDeviceOnline);
    this.moduleManager.on('person:device:offline', this._handleDeviceOffline);
    this.moduleManager.on('person:device:addedToEmployee', this._onDeviceAddedToEmployee);
    this.moduleManager.on('person:device:removedFromEmployee', this._onDeviceRemovedFromEmployee);
    this.moduleManager.on('person:slack:active', this._handleSlackActive);
    this.moduleManager.on('person:slack:away', this._handleSlackAway);
    this.moduleManager.on('synchronization:incoming:person:employee:createOrUpdate', this._onCreateOrUpdateEmployeeIncomingSynchronization);
    this.moduleManager.on('synchronization:incoming:person:employee:delete', this._onDeleteEmployeeIncomingSynchronization);
    this.moduleManager.on('person:employee:is_present', this._isPresent);
};

employee.prototype.stop = function () {
    this.moduleManager.removeListener('person:device:online', this._handleDeviceOnline);
    this.moduleManager.removeListener('person:device:offline', this._handleDeviceOffline);
    this.moduleManager.removeListener('person:device:addedToEmployee', this._onDeviceAddedToEmployee);
    this.moduleManager.removeListener('person:device:removedFromEmployee', this._onDeviceRemovedFromEmployee);
    this.moduleManager.removeListener('person:slack:active', this._handleSlackActive);
    this.moduleManager.removeListener('person:slack:away', this._handleSlackAway);
    this.moduleManager.removeListener('synchronization:incoming:person:employee:createOrUpdate', this._onCreateOrUpdateEmployeeIncomingSynchronization);
    this.moduleManager.removeListener('synchronization:incoming:person:employee:delete', this._onDeleteEmployeeIncomingSynchronization);
    this.moduleManager.removeListener('person:employee:is_present', this._isPresent);
};

employee.prototype._handleSlackAway = function (slack) {
    instance._retrieveByName(slack.name, function (employee) {
        instance.moduleManager.emit('person:employee:offline', employee);
    });
};

employee.prototype._handleSlackActive = function (slack) {
    instance._retrieveByName(slack.name, function (employee) {
        if (employee === undefined || employee === null) {
            self._addPresence(slack.name, slack.slack_id, function (employee) {
                self.moduleManager.emit('person:employee:online', employee);
            });
        } else {
            self.moduleManager.emit('person:employee:online', employee);
        }
    });
};

employee.prototype._handleDeviceOnline = function (device) {
    if (device.employee_id !== undefined && device.employee_id !== null) {

        instance._findById(device.employee_id, function (error, employee) {
            if (error) {
                logger.error(error.message);
            } else {

                if (employee !== undefined && !employee.is_present) {
                    employee.is_present = true;
                    employee.last_presence_date = device.last_presence_date;

                    instance._updateByAddress(employee.id, employee.is_present, function (error) {
                        if (error) {
                            logger.error(error.message);
                        } else {
                            instance.moduleManager.emit('person:employee:nearby', employee);
                        }
                    });
                } else {
                    employee.last_presence_date = device.last_presence_date;

                    instance._updateByAddress(employee.id, employee.is_present, function (error) {
                        if (error) {
                            logger.error(error.message);
                        }
                    });
                }
            }
        });
    }
};

employee.prototype._handleDeviceOffline = function (device) {
    if (device.employee_id !== undefined && device.employee_id !== null) {
        instance._findById(device.employee_id, function (error, employee) {
            if (error) {
                logger.error(error.message);
            } else {

                if (employee !== undefined) {
                    // only emit farway if the employee does not have any other device online
                    instance._retrieveAllOnlineDevicesByEmployeeId(employee.id, function (error, devices) {

                        if (error) {
                            logger.error(error.message);
                        } else {

                            if (devices && devices.length == 0 && employee.is_present) {

                                employee.is_present = false;
                                employee.last_presence_date = device.last_presence_date;

                                instance._updateByAddress(employee.id, employee.is_present, function (error) {
                                    if (error) {
                                        logger.error(error.message);
                                    } else {
                                        instance.moduleManager.emit('person:employee:faraway', employee);
                                    }
                                });
                            } else {
                                employee.last_presence_date = device.last_presence_date;

                                instance._updateByAddress(employee.id, employee.is_present, function (error) {
                                    if (error) {
                                        logger.error(error.message);
                                    }
                                });
                            }
                        }
                    })
                }
            }
        });
    }
};

employee.prototype._isPresent = function (employee, callback) {
    function handleArpDiscover() {
        instance.moduleManager.removeListener('monitor:arp:discover:finish', handleArpDiscover);

        instance._findDevicesById(employee.id, function (error, devices) {
            if (error) {
                logger.error(error.message);
            } else {
                if (devices !== undefined) {
                    var device = _.find(devices, {'is_present': true});
                    callback(device !== undefined);
                }
            }
        });
    }

    instance.moduleManager.on('monitor:arp:discover:finish', handleArpDiscover);
};

employee.prototype._onDeviceAddedToEmployee = function (device, employee) {
    instance._findById(employee.id, function (error, employee) {
        if (error) {
            logger.error(error.message);
        } else {

            if (device.is_present && employee !== undefined && !employee.is_present) {
                employee.is_present = true;

                instance._updateByAddress(employee.id, employee.is_present, function (error) {
                    if (error) {
                        logger.error(error.message);
                    } else {
                        instance.moduleManager.emit('person:employee:nearby', employee);
                    }
                });
            }
        }
    });
};

employee.prototype._onDeviceRemovedFromEmployee = function (device, employee) {
    instance._findById(employee.id, function (error, employee) {
        if (error) {
            logger.error(error.message);
        } else {

            if (employee !== undefined) {
                // only emit farway if the employee does not have any other device online
                instance._retrieveAllOnlineDevicesByEmployeeId(employee.id, function (error, devices) {

                    if (error) {
                        logger.error(error.message);
                    } else {

                        if (devices && devices.length == 0 && employee.is_present) {

                            employee.is_present = false;

                            instance._updateByAddress(employee.id, employee.is_present, function (error) {
                                if (error) {
                                    logger.error(error.message);
                                } else {
                                    instance.moduleManager.emit('person:employee:faraway', employee);
                                }
                            });
                        }
                    }
                })
            }
        }
    });
};

employee.prototype._onCreateOrUpdateEmployeeIncomingSynchronization = function (employee) {
    instance.moduleManager.emit('database:person:retrieveAll', 'PRAGMA table_info(employee)', [], function (error, rows) {
        if (error !== null) {
            logger.error(error.message);
        }

        employee = _.pick(employee, _.pluck(rows, 'name'));

        if (employee.created_date !== undefined && employee.created_date !== null) {
            employee.created_date = employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }
        if (employee.updated_date !== undefined && employee.updated_date !== null) {
            employee.updated_date = employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }
        if (employee.last_presence_date !== undefined && employee.last_presence_date !== null) {
            employee.last_presence_date = employee.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }

        var keys = _.keys(employee);
        var values = _.values(employee);

        instance._findById(employee.id, function (error, row) {
            if (error) {
                logger.error(error.message);
            } else {
                if (row !== undefined && moment(employee.updated_date).isAfter(row.updated_date)) {
                    keys = _.keys(_.omit(employee, ['is_present', 'last_presence_date']));
                    values = _.values(_.omit(employee, ['is_present', 'last_presence_date']));
                }

                instance.moduleManager.emit('database:person:create',
                    'INSERT OR REPLACE INTO employee (' + keys + ') VALUES (' + values.map(function () {
                        return '?';
                    }) + ');',
                    values,
                    function (error) {
                        if (error) {
                            logger.error(error.message);
                        }
                    });
            }
        });
    });
};

employee.prototype._onDeleteEmployeeIncomingSynchronization = function (employee) {
    instance.moduleManager.emit('database:person:delete',
        'SELECT * FROM employee WHERE id = ?',
        [employee.id], function (error, row) {
            if (error) {
                logger.error(error);
            } else {
                instance.moduleManager.emit('database:person:delete',
                    'DELETE FROM employee WHERE id = ?',
                    [employee.id], function (error) {
                        if (error) {
                            logger.error(error);
                        } else {
                            if (row.is_present) {
                                instance.moduleManager.emit('person:employee:faraway', row);
                            }
                        }
                    });
            }
        });
};

employee.prototype._findDevicesById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveAll',
        "SELECT * FROM device WHERE employee_id = ?;", [id],
        function (error, rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                });
            }

            callback(error, rows);
        });
};

employee.prototype._addPresence = function (name, slackId, callback) {
    this.moduleManager.emit('database:person:create',
        "INSERT INTO employee (name, slack_id) VALUES (?, ?);", [
            name,
            slackId
        ],
        function (error) {
            if (error) {
                callback(error);
            } else {
                callback({name: name});
            }
        });
};

employee.prototype._findById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM employee WHERE id = ?;", [id],
        function (error, row) {
            if (error) {
                callback(error);
            } else {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    if (row.last_presence_date !== undefined && row.last_presence_date !== null) {
                        row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    }
                }

                callback(error, row);
            }
        });
};

employee.prototype._retrieveByName = function (name, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM employee WHERE name LIKE ?;", [name],
        function (error, employee) {
            if (error) {
                callback(error);
            } else {
                callback(employee);
            }
        });
};

employee.prototype._retrieveAllOnlineDevicesByEmployeeId = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveAll',
        'SELECT * FROM device WHERE employee_id = ? AND is_present = 1;', [id],
        function (error, rows) {
            if (error) {
                callback(error);
            } else {
                callback(null, rows);
            }
        });
};

employee.prototype._updateById = function (id, employee, callback) {
    if (employee.created_date !== undefined && employee.created_date !== null && employee.created_date instanceof Date) {
        employee.created_date = employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (employee.updated_date !== undefined && employee.updated_date !== null && employee.updated_date instanceof Date) {
        employee.updated_date = employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(employee);
    var values = _.values(employee);

    instance.moduleManager.emit('database:person:update',
        'UPDATE employee SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE id = \'' + id + '\';',
        values, callback);
};

employee.prototype._updateByAddress = function (id, is_present, callback) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:person:update',
        "UPDATE employee SET updated_date = ?, is_present = ? WHERE id = ? AND is_present != ?;",
        [
            updatedDate,
            is_present,
            id,
            is_present
        ],
        function (error, id, changes) {
            if (error) {
                if (callback !== undefined) {
                    callback(error);
                }
            } else {
                if (changes > 0 && callback !== undefined) { // quick fix for racing condition of two consecutive updates
                    callback(null);
                }
            }
        });
};

var instance = new employee();

module.exports = instance;
