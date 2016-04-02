/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var SECRET = process.env.DOGBOT_SECRET,
  WATCHDOG_USEC = process.env.WATCHDOG_USEC,
  REPO_BRANCH = process.env.DOGBOT_BRANCH

var bot = require('./bot')(SECRET)

// shutdown gracefully
function _shutdown() {
  bot.stop(function () {
    process.exit(0)
  })
}

function _error(error) {
  bot.report(error)
}

process.on('SIGINT', _shutdown)
process.on('SIGTERM', _shutdown)

// force immediate shutdown, i.e. systemd watchdog?
process.on('SIGABRT', function () {
  process.exit(1)
})

process.on('SIGHUP', function () { // reload
  _shutdown()
})

// stop and then shutdown, i.e. forever daemon
process.once('SIGUSR2', function () {
  bot.stop(function () {
    process.kill(process.pid, 'SIGUSR2')
  })
})

process.on('exit', function () {
})

process.on('uncaughtException', _error)
process.on('unhandledRejection', _error)

if (!SECRET) {
  bot.error('Please provide a dog.ai secret.', function () {
    process.exit(1)
  })
} else {
  bot.start(function () {
    if (process.platform === 'linux') {
      require('./utils/systemd').sdNotify(0, 'READY=1', bot.error)
    }

    if (WATCHDOG_USEC) {
      bot.heartbeat(WATCHDOG_USEC, function (callback) {
        if (process.platform === 'linux') {
          require('./utils/systemd').sdNotify(0, 'WATCHDOG=1', callback)
        } else {
          if (callback) {
            callback()
          }
        }
      })
    }

    if (REPO_BRANCH) {
      bot.autoupdate(REPO_BRANCH, function (oldVer, newVer) {
        _shutdown()
      })
    }
  })
}
