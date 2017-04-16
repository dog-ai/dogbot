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

const Locale = require('native-speaker')
Locale.configure({ localePath: join(__dirname, '../locale') })

const SdNotifyWrapper = require('@dog-ai/sdnotify-wrapper')
const notifyReady = () => {
  if (process.platform === 'linux') {
    return SdNotifyWrapper.notify(false, 'READY=1')
      .catch((error) => Logger.error(error))
  }
}
const notifyHeartbeat = (callback = () => {}) => {
  if (process.platform === 'linux') {
    SdNotifyWrapper.notify(false, 'WATCHDOG=1')
      .catch((error) => Logger.error(error))
      .finally(() => callback())
  } else {
    callback()
  }
}

const Bot = require('./bot')

const shutdown = () => {
  Bot.stop()
    .then(() => Logger.info('Stopped dogbot'))
    .finally(() => process.exit(0))
}
const logErrorAndShutdown = (error) => Logger.error(error, () => process.exit(1))

process.on('uncaughtException', logErrorAndShutdown)
process.on('unhandledRejection', logErrorAndShutdown)
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('SIGHUP', shutdown)
process.on('SIGABRT', () => process.exit(1)) // force immediate exit, i.e. systemd watchdog?

Logger.info('Starting dogbot')

Bot.start(SECRET)
  .then(() => notifyReady())
  .then(() => {
    if (WATCHDOG_USEC) {
      return Bot.heartbeat(WATCHDOG_USEC, notifyHeartbeat)
        .then((interval) => Logger.info(`Sending a heartbeat every ${interval} seconds`))
    }
  })
  .catch((error) => logErrorAndShutdown(error))
