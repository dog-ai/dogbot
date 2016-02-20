#!/usr/bin/env node

var SECRET = process.env.DOGBOT_SECRET,
    WATCHDOG_USEC = process.env.WATCHDOG_USEC;

var bot = require('./bot')(SECRET);

process.on('SIGINT', function() {
    bot.stop(function () {
        process.exit(0);
    });
});

process.on('SIGHUP', function () {
    bot.reload(function () {
    });
});


process.once('SIGUSR2', function () {
    bot.reload(function () {
        process.kill(process.pid, 'SIGUSR2');
    });
});

process.on('exit', function () {
});

process.on('uncaughtException', function (error) {
    bot.logError(error);
});

if (SECRET === undefined) {
    bot.error("Please provide a dog.ai secret.", function () {
        process.exit(1);
    });
} else {
    bot.start(function () {
        if (WATCHDOG_USEC) {
            bot.heartbeat(WATCHDOG_USEC);
        }
    });
}