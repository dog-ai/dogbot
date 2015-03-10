/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var CronJob = require('cron').CronJob;

function morningmeeting() {
    var moduleManager = {};
}

morningmeeting.prototype.type = 'SCHEDULE';

morningmeeting.prototype.name = 'morningmeeting';

morningmeeting.prototype.info = function() {
    return '*' + this.name + '* - _Advertise the morning meeting everyday at 10:00 schedule module_';
}

morningmeeting.prototype.cron = "0 0 10 * * 0";

morningmeeting.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.schedule();
}

morningmeeting.prototype.unload = function() {}

morningmeeting.prototype.schedule = function() {
    var self = this;
    new CronJob(this.cron, function() {
        try {
            self.process();
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");
}

morningmeeting.prototype.process = function() {
    var outputs = {
        slack: {
            recipient: '#feedeo',
            message: "It's 10 o'clock. Gather up guys, we're having a morning meeting now."
        },
        voice: {
            recipient: null,
            message: "It's 10 o'clock. Gather up guys, we're having a morning meeting now."
        }
    };

    this.moduleManager.findAllLoadedModulesByType('IO').forEach(function(module) {
        var output = outputs[module.name];
        if (output !== undefined) {
            module.send(output.recipient, output.message);
        }
    });
}

module.exports = new morningmeeting();
