/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var CronJob = require('cron').CronJob;

function beeroclock() {
    var moduleManager = {};
}

beeroclock.prototype.type = 'SCHEDULE';

beeroclock.prototype.name = 'beeroclock';

beeroclock.prototype.info = function() {
    return '*' + this.name + '* - _Advertise beer o\'clock every Friday at 16:00 schedule module_';
};

beeroclock.prototype.cron = [
    "0 0 16 * * 5",
    "0 59 15 * * 5",
    "0 58 15 * * 5",
    "0 57 15 * * 5",
    "0 56 15 * * 5",
    "0 55 15 * * 5",
    "0 50 15 * * 5",
];

beeroclock.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    this.schedule();
};

beeroclock.prototype.unload = function () {
};

beeroclock.prototype.schedule = function() {
    var self = this;

    new CronJob(this.cron[0], function() {
        try {
            self.process();
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[1], function() {
        try {
            self._tminus("1 minute");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[2], function() {
        try {
            self._tminus("2 minutes");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[3], function() {
        try {
            self._tminus("3 minutes");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[4], function() {
        try {
            self._tminus("4 minutes");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[5], function() {
        try {
            self._tminus("5 minutes");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");

    new CronJob(this.cron[5], function() {
        try {
            self._tminus("10 minutes");
        } catch (error) {
            console.error('Unable to run schedule because ' + error);
        }
    }, null, true, "Europe/Stockholm");
};

beeroclock.prototype.process = function() {
    var outputs = {
        slack: {
            recipient: '#feedeo',
            message: '*It is Beer o\'clock!*' + '\n' +
                'https://lygsbtd.files.wordpress.com/2011/08/beer_toast.jpg?' + Math.random() + '\n' +
                'Well done guys! You\'ve managed to survive another week, go and grab yourselves a beer!'
        },
        voice: {
            recipient: null,
            message: 'It is Beer o\'clock!' +
                'Well done guys! You\'ve managed to survive another week, go and grab yourselves a beer!'
        }
    };

    this._advertise(outputs);
};

beeroclock.prototype._tminus = function(time) {
    var message = "T minus " + time;
    var outputs = {
        slack: {
            recipient: '#feedeo',
            message: message
        },
        voice: {
            recipient: null,
            message: message
        }
    };

    this._advertise(outputs);
};

beeroclock.prototype._advertise = function(outputs) {
    this.moduleManager.findAllLoadedModulesByType('IO').forEach(function(module) {
        var output = outputs[module.name];
        if (output !== undefined) {
            module.send(output.recipient, output.message);
        }
    });
};

module.exports = new beeroclock();
