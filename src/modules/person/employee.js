/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

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
    var self = this;

    this.moduleManager.on('person:device:online', function (device) {
        var that = self;

        self._retrieveById(device.employee, function (employee) {
            // only emit nearby if this is the only device online from the employee
            var self = that;
            that._retrieveAllOnlineDevicesById(employee.id, function (devices) {
                if (devices && devices.length == 1 && !employee.is_present) {
                    self.moduleManager.emit('person:employee:nearby', employee);
                }
            })
        });
    });

    this.moduleManager.on('person:device:offline', function (device) {
        var that = self;

        self._retrieveById(device.employee, function (employee) {
            // only emit farway if the employee does not have any other device online
            var self = that;
            that._retrieveAllOnlineDevicesById(employee.id, function (devices) {
                if (!devices && employee.is_present) {
                    self.moduleManager.emit('person:employee:faraway', employee);
                }
            })
        });
    });

    this.moduleManager.on('person:slack:active', function (slack) {
        var that = self;

        self._retrieveByName(slack.name, function (employee) {
            var self = that;

            if (employee === undefined || employee === null) {
                that._add(slack.name, slack.slack_id, function (employee) {
                    self.moduleManager.emit('person:employee:online', employee);
                });
            } else {
                that.moduleManager.emit('person:employee:online', employee);
            }
        });
    });

    this.moduleManager.on('person:slack:away', function (slack) {
        var that = self;

        self._retrieveByName(slack.name, function (employee) {
            that.moduleManager.emit('person:employee:offline', employee);
        });
    });
};

employee.prototype.stop = function () {
};

employee.prototype._add = function (name, slackId, callback) {
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

employee.prototype._retrieveById = function (id, callback) {
    this.moduleManager.emit('database:person:retrieveOne',
        "SELECT * FROM employee WHERE id = ?;", [id],
        function (error, row) {
            if (error) {
                callback(error);
            } else {
                callback(row);
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

employee.prototype._retrieveAllOnlineDevicesById = function (id, callback) {
    var self = this;

    this.moduleManager.emit('database:person:retrieveAll',
        'SELECT * FROM device WHERE employee = ?;', [id],
        function (error, rows) {
            if (error) {
                callback(error);
            } else {
                if (rows) {
                    var macAddresses = _.pluck(rows, 'mac_address');
                    self.moduleManager.emit('database:monitor:retrieveAll',
                        'SELECT * FROM arp WHERE mac_address IS IN (' + macAddresses + ');',
                        [],
                        function (error, rows) {
                            if (error) {
                                callback(error);
                            } else {
                                callback(null, rows);
                            }
                        });
                }
            }
        });
};

module.exports = new employee();
