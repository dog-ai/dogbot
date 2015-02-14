/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function beeroclock() {
    var bot = {};
}

beeroclock.prototype.type = 'SCHEDULE';

beeroclock.prototype.name = 'beeroclock';

beeroclock.prototype.info = function() {
    return '*' + this.name + '* - _Advertise beer o\'clock every friday at 16:00_';
}

beeroclock.prototype.cron = "0 0 16 * * 5";

beeroclock.prototype.schedule = function() {
    var channel = "#feedeo";
    var message = '*It is Beer o\'clock!*' + '\n' +
        'https://lygsbtd.files.wordpress.com/2011/08/beer_toast.jpg?' + Math.random() + '\n' +
        'Well done guys! You\'ve managed to survive another week, go and grab yourselves a beer!';

    this.bot.modules.forEach(function(module) {
        if (module.type === 'IO' && module.name === 'slack') {
            module.send(channel, message);
        }
    });
}

module.exports = new beeroclock();
