/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

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
    this.moduleManager.on('person:slack:active', this._handleSlackActive);
    this.moduleManager.on('person:slack:away', this._handleSlackAway);
    this.moduleManager.on('synchronization:person:employee', this._handleEmployeeSynchronization);
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
    instance._findByAddress(device.employee_id, function (error, employee) {
        if (!employee.is_present) {
            employee.is_present = true;

            instance._updateByAddress(employee.id, employee.is_present, function (error) {
                if (error) {
                    console.error(error.stack);
                } else {
                    instance.moduleManager.emit('person:employee:nearby', employee);
                }
            });
        }
    });
};

employee.prototype._handleDeviceOffline = function (device) {
    instance._findByAddress(device.employee_id, function (error, employee) {
        // only emit farway if the employee does not have any other device online

        instance._retrieveAllOnlineDevicesByEmployeeId(employee.id, function (error, devices) {

            if (error) {
                console.error(error.stack);
            } else {

                if (devices && devices.length == 0 && employee.is_present) {

                    employee.is_present = false;

                    instance._updateByAddress(employee.id, employee.is_present, function (error) {
                        if (error) {
                            console.error(error.stack);
                        } else {
                            instance.moduleManager.emit('person:employee:faraway', employee);
                        }
                    });
                }
            }
        })
    });
};

employee.prototype._handleEmployeeSynchronization = function (employee) {
    instance.moduleManager.emit('database:person:retrieveAll', 'PRAGMA table_info(employee)', [], function (error, rows) {
        if (error !== null) {
            throw error();
        }

        employee = _.pick(employee, _.pluck(rows, 'name'));

        if (employee.created_date !== undefined && employee.created_date !== null) {
            employee.created_date = employee.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }
        if (employee.updated_date !== undefined && employee.updated_date !== null) {
            employee.updated_date = employee.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }

        var keys = _.keys(employee);
        var values = _.values(employee);

        instance._findByAddress(employee.id, function (error, row) {
            if (error) {
                console.error(error.stack);
            } else {
                if (row !== undefined && moment(employee.updated_date).isAfter(row.updated_date)) {
                    keys = _.keys(_.omit(employee, 'is_present'));
                    values = _.values(_.omit(employee, 'is_present'));
                }

                instance.moduleManager.emit('database:person:create',
                    'INSERT OR REPLACE INTO employee (' + keys + ') VALUES (' + values.map(function () {
                        return '?';
                    }) + ');',
                    values,
                    function (error) {
                        if (error) {
                            console.error(error.stack);
                        }
                    });
            }
        });
    });
};

employee.prototype._;

employee.prototype.stop = function () {
    this.moduleManager.removeListener('person:device:online', this._handleDeviceOnline);
    this.moduleManager.removeListener('person:device:offline', this._handleDeviceOffline);
    this.moduleManager.removeListener('person:slack:active', this._handleSlackActive);
    this.moduleManager.removeListener('person:slack:away', this._handleSlackAway);
    this.moduleManager.removeListener('synchronization:person:employee', this._handleEmployeeSynchronization);
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

employee.prototype._findByAddress = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM employee WHERE id = ?;", [id],
        function (error, row) {
            if (error) {
                callback(error);
            } else {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
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
