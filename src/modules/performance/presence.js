/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

var moment = require('moment');

var CronJob = require('cron').CronJob;

function presence() {
    var moduleManager = {};
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
    this.moduleManager.on('synchronization:performance:presence', this._handlePresenceSynchronization)
};

presence.prototype.stop = function () {
    this.moduleManager.removeListener('person:employee:nearby', this._handleEmployeeMovement);
    this.moduleManager.removeListener('person:employee:faraway', this._handleEmployeeMovement);
    this.moduleManager.removeListener('synchronization:performance:presence', this._handlePresenceSynchronization);
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

presence.prototype._handlePresenceSynchronization = function (syncingPresence) {
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

var instance = new presence();

module.exports = instance;

