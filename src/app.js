#!/usr/bin/env node

var SECRET = process.env.DOGBOT_SECRET,
    WATCHDOG_USEC = process.env.WATCHDOG_USEC;

var bot = require('./bot')(SECRET);

function shutdown() {
    bot.stop(function () {
        process.exit(0);
    });
}

process.on('SIGINT', shutdown); // shutdown gracefully
process.on('SIGTERM', shutdown);

process.on('SIGABRT', function () { // force immediate shutdown, i.e. systemd watchdog
    process.exit(1);
});

process.on('SIGHUP', function () { // reload
    bot.reload(function () {
    });
});

process.once('SIGUSR2', function () { // reload and then shutdown, i.e. forever daemon
    bot.reload(function () {
        process.kill(process.pid, 'SIGUSR2');
    });
});

process.on('exit', function () {
});

process.on('uncaughtException', function (error) {
    bot.error(error);
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