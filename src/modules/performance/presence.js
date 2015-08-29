/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

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
    this.moduleManager.on('person:employee:nearby', this._handleEmployee);
    this.moduleManager.on('person:employee:faraway', this._handleEmployee);
};

presence.prototype.stop = function () {
    this.moduleManager.removeListener('person:employee:nearby', this._handleEmployee);
    this.moduleManager.removeListener('person:employee:faraway', this._handleEmployee);
};

presence.prototype._handleEmployee = function (employee) {
    instance._findLatestById(employee.id, function (error, performance) {
        if (error) {
            console.error(error);
        } else {
            if (performance && performance.is_present == employee.is_present) {
                return;
            }

            instance._add(employee.id, employee.is_present, function (error) {
                if (error) {
                    console.error(error);
                }
            });
        }
    });
};

presence.prototype._add = function (id, is_present, callback) {
    this.moduleManager.emit('database:performance:create',
        "INSERT INTO presence (employee_id, is_present) VALUES (?, ?);", [
            id,
            is_present
        ], callback);
};

presence.prototype._findLatestById = function (id, callback) {
    this.moduleManager.emit('database:performance:retrieveOne',
        "SELECT * from presence WHERE employee_id = ? ORDER BY created_date DESC;",
        [id], callback);
};

var instance = new presence();

module.exports = instance;

