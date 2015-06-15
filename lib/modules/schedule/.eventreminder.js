/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var _ = require('lodash');
var CronJob = require('cron').CronJob;
var moment = require('moment');

var reminders = [];

function eventreminder() {
    var moduleManager = {};
}

eventreminder.prototype.type = 'SCHEDULE';

eventreminder.prototype.name = 'eventreminder';

eventreminder.prototype.info = function() {
    return '*' + this.name + '* - _Remind calendar events schedule module_';
}

eventreminder.prototype.cron = "0 */5 * * * *";

eventreminder.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.schedule();
}

eventreminder.prototype.unload = function() {}

eventreminder.prototype.schedule = function() {
    var self = this;
    new CronJob(this.cron, function() {
        try {
            self.process();
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");
}

eventreminder.prototype.process = function() {
    var self = this;

    var google = this.moduleManager.findLoadedModuleByName('google');
    google.getAccounts(function(error, accounts) {
        if (error !== undefined && error !== null) {
            console.error(error);
        } else {
            var calendar = self.moduleManager.findLoadedModuleByName('calendar');

            accounts.forEach(function(account) {

                calendar.retrieveEventListForToday(account.user_id, account.access_token, function(error, eventList) {
                    if (error !== undefined && error !== null) {
                        console.error(error);
                    } else {
                        eventList.items.forEach(function(event) {
                            var reminder = _.find(reminders, function(r) {
                                return r.event.id === event.id;
                            });

                            if (reminder !== undefined && reminder.event.start.dateTime !== event.start.dateTime) {
                                reminder.job.stop();
                                 _.remove(reminders, function(r) {
                                    return r.event.id === reminder.event.id;
                                });
                            }

                            if (reminder === undefined) {
                                var date = moment(event.start.dateTime).subtract(1, 'minute').toDate();

                                if (moment(new Date()).isBefore(date)) {
                                    var reminder = {};
                                    reminder.event = event;
                                    reminder.job = new CronJob(date, function() {
                                        try {
                                            self._remind(reminder);
                                        } catch (error) {
                                            console.error('Unable to run schedule because ' + error);
                                        }
                                    }, null, true, "Europe/Stockholm");

                                    reminders.push(reminder);
                                }
                            }
                        });
                    }

                    reminders.forEach(function(reminder) {
                        var event = _.find(eventList.items, function(e) {
                            return e.id === reminder.event.id;
                        });

                        if (event === undefined) {
                             _.remove(reminders, function(r) {
                                return r.event.id === reminder.event.id;
                            });
                        }
                    });
                });
            });
        }
    });
}

eventreminder.prototype._remind = function(reminder) {
    var outputs = {
        slack: {
            recipient: '#feedeo',
            message: reminder.event.summary + ' is coming up. It will start in 1 minute.'
        },
        voice: {
            recipient: null,
            message: reminder.event.summary + ' is coming up. It will start in 1 minute.'
        }
    };

    this._advertise(outputs);

    _.remove(reminders, function(r) {
        return r.event.id === reminder.event.id;
    });
}

eventreminder.prototype._advertise = function(outputs) {
    this.moduleManager.findAllLoadedModulesByType('IO').forEach(function(module) {
        var output = outputs[module.name];
        if (output !== undefined) {
            module.send(output.recipient, output.message);
        }
    });
}

module.exports = new eventreminder();
