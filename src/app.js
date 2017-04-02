/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const LOG_TYPE = process.env.DOGBOT_LOG_TYPE || 'console'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const SECRET = process.env.DOGBOT_SECRET
const WATCHDOG_USEC = process.env.WATCHDOG_USEC

const Logger = require('modern-logger')

const { join } = require('path')

let transports
if (LOG_TYPE === 'file') {
  transports = { console: [], file: [] }

  transports[ 'file' ].push({
    name: 'log', // http://stackoverflow.com/a/17374968
    level: LOG_LEVEL === 'debug' ? 'info' : LOG_LEVEL,
    filename: join(__dirname, '../var/log/dogbot.log'),
    colorize: false,
    maxFiles: 8,
    maxsize: 102400, // 100 KiB,
    zippedArchive: true
  })

  if (LOG_LEVEL === 'debug') {
    transports[ 'file' ].push({
      name: 'tmp', // http://stackoverflow.com/a/17374968
      filename: join(__dirname, '../var/tmp/dogbot.log'),
      colorize: false,
      maxFiles: 2,
      maxsize: 10240000, // 10 MiB
      zippedArchive: true
    })
  }
}
Logger.configure({ transports, enableEmoji: false })

const Bot = require('./bot')

// shutdown gracefully
const stopAndExit = () => {
  Bot.stop()
    .then(() => Logger.info('Stopped dogbot'))
    .finally(() => process.exit(0))
}

// log error and exit immediately
const logErrorAndExit = (error) => {
  Logger.error(error, () => process.exit(1))
}

process.on('uncaughtException', logErrorAndExit)
process.on('unhandledRejection', logErrorAndExit)
process.on('SIGINT', stopAndExit)
process.on('SIGTERM', stopAndExit)
process.on('SIGHUP', stopAndExit)
process.on('SIGABRT', () => process.exit(1)) // force immediate exit, i.e. systemd watchdog?

Logger.info('Starting dogbot')

Bot.start(SECRET)
  .then(() => {
    if (process.platform === 'linux') {
      require('./utils/systemd').sdNotify(0, 'READY=1', (error) => {
        if (error) {
          Logger.error(error.message, error)
        }
      })
    }

    if (WATCHDOG_USEC) {
      const heartbeat = (callback = () => {}) => {
        if (process.platform === 'linux') {
          require('./utils/systemd').sdNotify(0, 'WATCHDOG=1', callback)
        } else {
          callback()
        }
      }

      Bot.heartbeat(WATCHDOG_USEC, heartbeat)
        .then((interval) => {
          Logger.info(`Sending a heartbeat every ${interval} seconds`)
        })
    }
  })
  .catch((error) => logErrorAndExit(error))
