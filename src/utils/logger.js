/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var util = require('util'),
  winston = require('winston'),
  fs = require('fs'),
  moment = require('moment');

var LOG_DIR = __dirname + '/../../var/log';
var TMP_DIR = __dirname + '/../../var/tmp';
var LOG_TYPE = process.env.DOGBOT_LOG_TYPE || 'console';
var LOG_LEVEL = process.env.DOGBOT_LOG_LEVEL || 'info';
var ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'development';
var BRANCH = process.env.DOGBOT_REPO_BRANCH || 'develop';

winston.emitErrs = true;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

var timeFormat = function () {
  return moment().format('YYYY-MM-DDTHH:mm:ss,SSSZ');
};

var transports = [];

switch (LOG_TYPE) {
  case 'console':
    transports.push(new winston.transports.Console({
      level: LOG_LEVEL,
      json: false,
      colorize: true,
      timestamp: timeFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true
    }));
    break;
  case 'file':
    transports.push(new (require('winston-daily-rotate-file'))({
      name: 'log', // http://stackoverflow.com/a/17374968
      level: LOG_LEVEL === 'debug' ? 'info' : LOG_LEVEL,
      filename: LOG_DIR + '/dogbot.log',
      json: false,
      colorize: false,
      maxFiles: 8,
      timestamp: timeFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true
    }));

    if (LOG_LEVEL === 'debug') {
      transports.push(new (require('winston-daily-rotate-file'))({
        name: 'tmp', // http://stackoverflow.com/a/17374968
        level: LOG_LEVEL,
        filename: TMP_DIR + '/dogbot.log',
        json: false,
        colorize: false,
        maxFiles: 2,
        timestamp: timeFormat,
        handleExceptions: true,
        humanReadableUnhandledException: true
      }));
    }
    break;
}

switch (ENVIRONMENT) {
  case 'production':

    var rollbar = require('rollbar');
    rollbar.init('0e93b088a46f4376bc4c4d2fe871f832', {
      branch: BRANCH,
      environment: ENVIRONMENT
    });

    var RollbarLogger = function (options) {
      this.name = 'rollbar';
      this.level = options && options.level || 'error';
      this.handleExceptions = true;
      this.humanReadableUnhandledException = true;
    };

    util.inherits(RollbarLogger, winston.Transport);

    RollbarLogger.prototype.log = function (level, msg, meta, callback) {
      if (level === 'error') {
        rollbar.handleError(meta instanceof Error ? meta : msg, function (error) {
          if (error) {
            return callback(error);
          } else {
            return callback(null, true);
          }
        });
      }
    };

    transports.push(new RollbarLogger());

    break;
}

var logger = new winston.Logger({
  transports: transports,
  exitOnError: false
});

module.exports = logger;

module.exports.stream = {
  write: function (message, encoding) {
    logger.info(message);
  }
};

