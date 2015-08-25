/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var CronJob = require('cron').CronJob;

function arp() {
    var moduleManager = {};
    var cron = undefined;
}

arp.prototype.type = "PERFORMANCE";

arp.prototype.name = "arp";

arp.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

arp.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

arp.prototype.unload = function () {
    this.stop();
};

arp.prototype.start = function () {
    var self = this;

    this.cron = new CronJob('0 0 * * * *', function () {
        self._sample(function (error) {
            console.error(error);
        });
    }, null, true, "Europe/Stockholm");
};

arp.prototype.stop = function () {
    this.cron.stop();
};

arp.prototype._sample = function (callback) {
    var self = this;

    var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this._count(function (error, value) {
        if (error) {
            throw error;
        } else {
            self._add(date, value, function (error) {
                if (error) {
                    throw error;
                }
            });
        }
    })
};

arp.prototype._add = function (date, value, callback) {
    var self = this;

    this.moduleManager.emit('database:performance:create',
        "INSERT INTO arp (date, value) VALUES (?, ?);", [
            date,
            value
        ],
        function (error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('database:performance:delete',
                    'DELETE FROM arp WHERE id NOT IN (SELECT id FROM arp ORDER BY date DESC LIMIT 24)',
                    [], function (error) {
                        if (error) {
                            callback(error);
                        } else {
                            callback(null);
                        }
                    });
            }
        });
};

arp.prototype._count = function (callback) {
    this.moduleManager.emit('database:monitor:retrieveOne',
        "SELECT COUNT(*) as count FROM arp;", [],
        function (error, row) {
            if (error) {
                callback(error);
            } else {
                callback(null, row.count);
            }
        });
};

module.exports = new arp();
