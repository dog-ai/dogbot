/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function beeroclock() {
    var bot = {};
}

beeroclock.prototype.type = 'SCHEDULE';

beeroclock.prototype.name = 'beeroclock';

beeroclock.prototype.info = function() {
    return '*' + this.name + '* - _Advertise beer o\'clock every Friday at 16:00 schedule module_';
}

beeroclock.prototype.cron = "0 0 16 * * 5";

beeroclock.prototype.schedule = function() {
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

    this.bot.modules.forEach(function(module) {
        if (module.type === 'IO') {
            var output = outputs[module.name];
            if (output !== undefined) {
                module.send(output.recipient, output.message);
            }
        }
    });
}

module.exports = new beeroclock();
