/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

var _ = require('lodash');

var moment = require('moment');
var later = require('later');

later.date.localTime();

function presence() {
    var communication = {};
    var generateDailyStats = undefined;
}

presence.prototype.type = "PERFORMANCE";

presence.prototype.name = "presence";

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

presence.prototype.unload = function () {
    this.stop();
};

presence.prototype.start = function () {
    this.communication.on('person:employee:nearby', this._onEmployeePresence);
    this.communication.on('person:employee:faraway', this._onEmployeePresence);
    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);


    var schedule = later.parse.text('at 00:00');
    this.generateDailyStats = later.setInterval(function () {
        var date = moment().subtract(1, 'day');
        instance._generateDailyStats(date);
    }, schedule);
};

presence.prototype.stop = function () {
    this.generateDailyStats.clear();

    this.communication.removeListener('person:employee:nearby', this._onEmployeePresence);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresence);
    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
};

presence.prototype._onEmployeePresence = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id, function (error, performance) {
        if (error) {
            logger.error(error.stack);
        } else {
            if (performance && performance.is_present == employee.is_present) {
                return;
            }

            instance._createPresence({employee_id: employee.id, is_present: employee.is_present}, function (error) {
                if (error) {
                    logger.error(error.stack);
                }
            });
        }
    });
};

presence.prototype._onIncomingPresenceSynchronization = function (syncingPresence) {
    instance.communication.emit('database:performance:retrieveAll', 'PRAGMA table_info(presence)', [], function (error, rows) {

        syncingPresence = _.pick(syncingPresence, _.pluck(rows, 'name'));

        instance._findLatestPresenceByEmployeeId(syncingPresence.employee_id, function (error, presence) {
            if (error) {
                logger.error(error.stack);
            } else {


                if (presence === undefined) {
                    instance._createPresence(syncingPresence, function (error) {
                        if (error) {
                            logger.error(error.stack);
                        }
                    });
                } else {
                    if (moment(syncingPresence.created_date).isAfter(presence.created_date)) {
                        instance._createPresence(syncingPresence, function (error) {
                            if (error) {
                                logger.error(error.stack);
                            }
                        });
                    }
                }
            }
        });
    });
};

presence.prototype._onOutgoingPresenceSynchronization = function (callback) {
    instance.communication.emit('database:performance:retrieveOneByOne',
        'SELECT * FROM presence WHERE is_synced = 0', [], function (error, row) {
            if (error) {
                logger.error(error.stack);
            } else {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.is_present = row.is_present == 1 ? true : false;

                    callback(error, row.employee_id, 'presence', row, function (error) {
                        if (error) {
                            logger.error(error)
                        } else {
                            instance.communication.emit('database:performance:update',
                                'UPDATE presence SET is_synced = 1 WHERE id = ?', [row.id], function (error) {
                                    if (error) {
                                        logger.error(error.stack);
                                    }
                                });
                        }
                    });
                }
            }
        });
};

presence.prototype._generateDailyStats = function (date) {
    instance._findAllEmployees()
        .then(function (employee) {
            return instance._computeEmployeeDailyStats(employee, date)
                .then(function (stats) {
                    return instance._synchronizeEmployeeDailyStats(employee, date, stats);
                });
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeDailyStats = function (employee, date) {
    var _stats = {};

    return instance._computeEmployeeDailyTotalDuration(employee, date)
        .then(function (totalDuration) {
            _stats._total_duration = totalDuration;
            return instance._computeEmployeeDailyStartTime(employee, date);
        }).then(function (startTime) {
            _stats._start_time = startTime;
            return instance._computeEmployeeDailyEndTime(employee, date);
        }).then(function (endTime) {
            _stats._end_time = endTime;
        }).then(function () {
            return _stats;
        })
        .catch(function (error) {
            logger.error(error);
        });
};

presence.prototype._computeEmployeeDailyTotalDuration = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findAllByEmployeeIdAndBetweenDates(employee.id, startDate, endDate)
        .then(function (rows) {
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

            return totalDuration.asSeconds();
        });
};

presence.prototype._computeEmployeeDailyStartTime = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findFirstDatePresenceByEmployeeId(employee.id, startDate, endDate)
        .then(function (presence) {
            if (presence !== undefined) {
                return date.startOf('day').diff(moment(presence.created_date), 'seconds');
            } else {
                return 0;
            }
        });
};

presence.prototype._computeEmployeeDailyEndTime = function (employee, date) {
    var startDate = date.startOf('day').toDate();
    var endDate = date.endOf('day').toDate();
    return instance._findLastDatePresenceByEmployeeId(employee.id, startDate, endDate)
        .then(function (presence) {
            if (presence !== undefined) {
                return date.startOf('day').diff(moment(presence.created_date), 'seconds');
            } else {
                return 0;
            }
        });
};

presence.prototype._synchronizeEmployeeDailyStats = function (employee, date, stats) {
    return instance.communication.emitAsync('synchronization:outgoing:performance:stats', employee, 'presence', date, stats);
};

presence.prototype._createPresence = function (presence, callback) {
    if (presence.created_date !== undefined && presence.created_date !== null) {
        presence.created_date = presence.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(presence);
    var values = _.values(presence);

    this.communication.emit('database:performance:create',
        "INSERT INTO presence (" + keys + ") VALUES (" + values.map(function () {
            return '?';
        }) + ");",
        values, callback);
};

presence.prototype._findLatestPresenceByEmployeeId = function (id) {
    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;",
        [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findLastDatePresenceByEmployeeId = function (id, startDate, endDate) {
    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date DESC LIMIT 1;",
        [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findFirstDatePresenceByEmployeeId = function (id, startDate, endDate) {
    return this.communication.emitAsync('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC LIMIT 1;",
        [id])
        .then(function (row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
            }

            return row;
        });
};

presence.prototype._findAllByEmployeeIdAndBetweenDates = function (id, startDate, endDate) {
    startDate = startDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    endDate = endDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return this.communication.emitAsync('database:performance:retrieveAll',
        "SELECT * from presence WHERE employee_id = ? AND Datetime(?) < created_date AND created_date < Datetime(?) ORDER BY created_date ASC;",
        [id, startDate, endDate]
    ).then(function (rows) {
            if (rows !== undefined) {
                rows.forEach(function (row) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                });

                return rows;
            }
        });
};

presence.prototype._findAllEmployees = function () {
    return this.communication.emitAsync('database:person:retrieveOneByOne', 'SELECT * FROM employee;', []);
};

var instance = new presence();

module.exports = instance;

