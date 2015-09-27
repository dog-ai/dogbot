/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');

var moment = require('moment');
var later = require('later');
var CronJob = require('cron').CronJob;

later.date.localTime();

function presence() {
    var moduleManager = {};
    var dailyPresenceDurationInterval = undefined;
}

presence.prototype.type = "PERFORMANCE";

presence.prototype.name = "presence";

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

presence.prototype.unload = function () {
    this.stop();
};

presence.prototype.start = function () {
    this.moduleManager.on('person:employee:nearby', this._handleEmployeeMovement);
    this.moduleManager.on('person:employee:faraway', this._handleEmployeeMovement);
    this.moduleManager.on('synchronization:incoming:performance:presence', this._handlePresenceIncomingSynchronization);
    this.moduleManager.on('synchronization:outgoing:performance:presence', this._handlePresenceOutgoingSynchronization);


    var schedule = later.parse.text('at 01:00');
    this.dailyPresenceDurationInterval = later.setInterval(function () {
        var date = moment().subtract(1, 'day');
        instance._computeDatePresenceDurationForAllEmployees(date);
    }, schedule);
};

presence.prototype.stop = function () {
    this.dailyPresenceDurationInterval.clear();

    this.moduleManager.removeListener('person:employee:nearby', this._handleEmployeeMovement);
    this.moduleManager.removeListener('person:employee:faraway', this._handleEmployeeMovement);
    this.moduleManager.removeListener('synchronization:incoming:performance:presence', this._handlePresenceIncomingSynchronization);
    this.moduleManager.removeListener('synchronization:outgoing:performance:presence', this._handlePresenceOutgoingSynchronization);
};

presence.prototype._handleEmployeeMovement = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id, function (error, performance) {
        if (error) {
            console.error(error.stack);
        } else {
            if (performance && performance.is_present == employee.is_present) {
                return;
            }

            instance._addPresence({employee_id: employee.id, is_present: employee.is_present}, function (error) {
                if (error) {
                    console.error(error.stack);
                }
            });
        }
    });
};

presence.prototype._handlePresenceIncomingSynchronization = function (syncingPresence) {
    instance._findLatestPresenceByEmployeeId(syncingPresence.employee_id, function (error, presence) {
        if (error) {
            console.error(error.stack);
        } else {
            if (presence === undefined) {
                instance._addPresence(syncingPresence, function (error) {
                    if (error) {
                        console.error(error.stack);
                    }
                });
            } else {
                if (moment(syncingPresence.created_date).isAfter(presence.created_date)) {
                    instance._addPresence(syncingPresence, function (error) {
                        if (error) {
                            console.error(error.stack);
                        }
                    });
                }
            }
        }
    });
};

presence.prototype._handlePresenceOutgoingSynchronization = function (callback) {
    instance.moduleManager.emit('database:performance:retrieveOneByOne',
        'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
            if (error) {
                console.error(error.stack);
            } else {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.is_present = row.is_present == 1 ? true : false;

                    callback(error, row.employee_id, 'presence', row, function (error) {
                        if (error) {
                            console.error(error)
                        } else {
                            instance.moduleManager.emit('database:performance:update',
                                'UPDATE presence SET is_synced = 1 WHERE id = ?', [row.id], function (error) {
                                    if (error) {
                                        console.error(error.stack);
                                    }
                                });
                        }
                    });
                }
            }
        });
};

presence.prototype._addPresence = function (presence, callback) {
    if (presence.created_date !== undefined && presence.created_date !== null) {
        presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(presence);
    var values = _.values(presence);

    this.moduleManager.emit('database:performance:create',
        "INSERT INTO presence (" + keys + ") VALUES (" + values.map(function () {
            return '?';
        }) + ");",
        values, callback);
};

presence.prototype._computeDatePresenceDurationForAllEmployees = function (date) {
    instance._findAllEmployees(function (error, employee) {

        if (error) {
            console.error(error.stack);
        } else {

            var startDate = date.startOf('day').toDate();
            var endDate = date.endOf('day').toDate();

            instance._computePresenceDurationBetweenDatesByEmployeeId(employee.id, startDate, endDate, function (error, duration) {

                if (error) {
                    console.error(error.stack);
                } else {
                    console.log("Presence duration for " + employee.id + " on " + date.format('YYYY/MM/DD') + ": " + duration.hours() + ":" + duration.minutes());
                }
            });
        }
    });
};

presence.prototype._computePresenceDurationBetweenDatesByEmployeeId = function (employeeId, startDate, endDate, callback) {
    instance._findAllByEmployeeIdAndBetweenDates(employeeId, startDate, endDate, function (error, rows) {
        if (error) {
            callback(error);
        } else {
            var totalDuration = moment.duration();

            if (rows != undefined) {
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].is_present) {
                        if (i + 1 < rows.length) {
                            var next = rows[i + 1];
                            var diff = moment(next.created_date).diff(moment(rows[i].created_date));
                            totalDuration = totalDuration.add(diff);
                        }
                    } else {

                    }
                }
            }

            callback(null, totalDuration);
        }
    });
};

presence.prototype._findLatestPresenceByEmployeeId = function (id, callback) {
    this.moduleManager.emit('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;",
        [id], function (error, row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            callback(error, row);
        });
};

presence.prototype._findAllByEmployeeIdAndBetweenDates = function (id, startDate, endDate, callback) {
    startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:performance:retrieveAll',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC;",
        [id, startDate, endDate], function (error, rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                });
            }

            callback(error, rows);
        });
};

presence.prototype._findAllEmployees = function (callback) {
    this.moduleManager.emit('database:person:retrieveOneByOne',
        'SELECT * FROM employee;', [], callback);
};

var instance = new presence();

module.exports = instance;

