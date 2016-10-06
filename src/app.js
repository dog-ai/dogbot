/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const SECRET = process.env.DOGBOT_SECRET
const WATCHDOG_USEC = process.env.WATCHDOG_USEC

const Logger = require('./utils/logger.js')
const Bot = require('./bot')

const logErrorAndExit = (error) => {
  Logger.error(error.message, error, () => process.exit(1))
}

process.on('uncaughtException', logErrorAndExit)
process.on('unhandledRejection', logErrorAndExit)

try {
  const bot = new Bot(SECRET)

  // shutdown gracefully
  const stopAndExit = () => {
    bot.stop()
      .finally(() => process.exit(0))
  }

  bot.start()
    .then(() => {
      if (process.platform === 'linux') {
        require('./utils/systemd').sdNotify(0, 'READY=1', (error) => {
          if (error) {
            Logger.error(error.message, error)
          }
        })
      }

      if (WATCHDOG_USEC) {
        bot.heartbeat(WATCHDOG_USEC, (callback) => {
          if (process.platform === 'linux') {
            require('./utils/systemd').sdNotify(0, 'WATCHDOG=1', callback)
          } else {
            if (callback) {
              callback()
            }
          }
        })
      }
    })

  process.on('SIGINT', stopAndExit)
  process.on('SIGTERM', stopAndExit)
  process.on('SIGHUP', stopAndExit)
  process.on('SIGABRT', () => process.exit(1)) // force immediate exit, i.e. systemd watchdog?
} catch (error) {
  logErrorAndExit(error)
}

