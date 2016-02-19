#!/usr/bin/env node

var SECRET = process.env.DOGBOT_SECRET;

var bot = require('./bot')(SECRET);

process.on('SIGINT', function() {
    bot.stop(function () {
        process.exit(0);
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
    bot.error(error);
});

if (SECRET === undefined) {
    bot.error("Please provide a dog.ai secret.", function () {
        process.exit(1);
    });
} else {
    bot.start(function () {
    });
}