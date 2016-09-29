/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const LOG_TYPE = process.env.DOGBOT_LOG_TYPE || 'console'
const LOG_LEVEL = process.env.DOGBOT_LOG_LEVEL || 'info'
const ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'development'
const BRANCH = process.env.DOGBOT_REPO_BRANCH || 'develop'

const util = require('util')
const fs = require('fs')
const path = require('path')

const winston = require('winston')
const moment = require('moment')

const LOG_DIR = path.join(__dirname, '/../../var/log')
const TMP_DIR = path.join(__dirname, '/../../var/tmp')

winston.emitErrs = true

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR)
}

const timeFormat = () => {
  return moment().format('YYYY-MM-DDTHH:mm:ss,SSSZ')
}

const transports = []

switch (LOG_TYPE) {
  case 'console':
    transports.push(new winston.transports.Console({
      level: LOG_LEVEL,
      json: false,
      colorize: true,
      timestamp: timeFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true
    }))
    break
  case 'file':
    transports.push(new (winston.transports.File)({
      name: 'log', // http://stackoverflow.com/a/17374968
      level: LOG_LEVEL === 'debug' ? 'info' : LOG_LEVEL,
      filename: LOG_DIR + '/dogbot.log',
      json: false,
      colorize: false,
      maxFiles: 8,
      maxsize: 102400, // 100 KiB,
      zippedArchive: true,
      timestamp: timeFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true
    }))

    if (LOG_LEVEL === 'debug') {
      transports.push(new (winston.transports.File)({
        name: 'tmp', // http://stackoverflow.com/a/17374968
        level: LOG_LEVEL,
        filename: TMP_DIR + '/dogbot.log',
        json: false,
        colorize: false,
        maxFiles: 2,
        maxsize: 10240000, // 10 MiB
        zippedArchive: true,
        timestamp: timeFormat,
        handleExceptions: true,
        humanReadableUnhandledException: true
      }))
    }
    break
}

switch (ENVIRONMENT) {
  case 'production':

    const rollbar = require('rollbar')
    rollbar.init('0e93b088a46f4376bc4c4d2fe871f832', {
      branch: BRANCH,
      environment: ENVIRONMENT
    })

    const RollbarLogger = function (options) {
      this.name = 'rollbar'
      this.level = options && options.level || 'error'
      this.handleExceptions = true
      this.humanReadableUnhandledException = true
    }

    util.inherits(RollbarLogger, winston.Transport)

    RollbarLogger.prototype.log = function (level, msg, meta, callback) {
      if (level === 'error') {
        let error
        let payload = { level }
        if (msg !== '' && meta) {
          error = new Error()
          error.stack = msg

          if (msg.indexOf('\n') > -1) {
            error.message = msg.substring(7, msg.indexOf('\n'))
          }

          payload.session = meta
        } else {
          error = meta
        }

        rollbar.handleErrorWithPayloadData(error, payload, function (error) {
          if (error) {
            return callback(error)
          } else {
            return callback(null, true)
          }
        })
      }
    }

    transports.push(new RollbarLogger())

    break
}

const Logger = new winston.Logger({
  transports: transports,
  exitOnError: false
})

module.exports = Logger

module.exports.stream = {
  write: function (message) {
    Logger.info(message)
  }
}

