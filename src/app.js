/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var SECRET = process.env.DOGBOT_SECRET,
    WATCHDOG_USEC = process.env.WATCHDOG_USEC,
    REPO_BRANCH = process.env.DOGBOT_BRANCH;

var bot = require('./bot')(SECRET);

// shutdown gracefully
function shutdown() {
    bot.stop(function () {
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// force immediate shutdown, i.e. systemd watchdog?
process.on('SIGABRT', function () {
    process.exit(1);
});

process.on('SIGHUP', function () { // reload
    shutdown();
});

// stop and then shutdown, i.e. forever daemon
process.once('SIGUSR2', function () {
    bot.stop(function () {
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
        if (process.platform === 'linux') {
            require('./utils/systemd').sdNotify(0, 'READY=1', function (error) {
                if (error) {
                    bot.error(error);
                }
            });
        }

        if (WATCHDOG_USEC) {
            bot.heartbeat(WATCHDOG_USEC, function (callback) {
                if (process.platform === 'linux') {
                    require('./utils/systemd').sdNotify(0, 'WATCHDOG=1', callback);
                } else {
                    if (callback) {
                        callback();
                    }
                }
            });
        }

        if (REPO_BRANCH) {
            bot.autoupdate(REPO_BRANCH, function (oldVer, newVer) {
                shutdown();
            });
        }
    });
}