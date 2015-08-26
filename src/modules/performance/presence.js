/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var CronJob = require('cron').CronJob;

function presence() {
    var moduleManager = {};
    var cron = undefined;
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
    //var self = this;

    //this.cron = new CronJob('0 */1 * * * *', function () {
    //    self._detect();
    //}, null, true, "Europe/Stockholm");
};

presence.prototype.stop = function () {
    this.cron.stop();
};

presence.prototype._detect = function () {
    var self = this;

    this._findAllEmployeesPresence(function (error, employee) {
        if (error) {
            console.error(error);
        } else {

            if (employee !== undefined) {
                self._add(employee, function (error) {
                    if (error) {
                        console.error(error);
                    }
                })
            }
        }
    });
};

presence.prototype._add = function (employee, callback) {
    this.moduleManager.emit('database:performance:create',
        "INSERT INTO presence (employee_id, is_present) VALUES (?, ?);", [
            employee.id,
            employee.is_present
        ],
        function (error) {
            if (error) {
                if (callback !== undefined) {
                    callback(error);
                }
            }
        });
};

presence.prototype._findAllEmployeesPresence = function (callback) {
    var self = this;

    var updatedDate = (new Date(new Date().setMinutes(new Date().getMinutes() - 5))).toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:person:retrieveOneByOne',
        "SELECT d.mac_address, e.id FROM device d, employee e WHERE d.employee_id = e.id;", [],
        function (error, row) {
            if (error) {
                if (callback !== undefined) {
                    callback(error);
                }
            } else {
                var employeeId = row.id;
                self.moduleManager.emit('database:monitor:retrieveOne',
                    'SELECT * FROM arp WHERE mac_address = ? and Datetime(?) < updated_date', [row.mac_address, updatedDate],
                    function (error, row) {
                        console.log("AQUI " + row);
                        if (error) {
                            callback(error);
                        } else {
                            if (callback !== undefined) {
                                callback(null, {
                                    id: employeeId,
                                    is_present: row === undefined ? false : true
                                });
                            }
                        }
                    });
            }
        });
};

module.exports = new presence();

