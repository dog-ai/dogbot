/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var winston = require('winston'),
    fs = require('fs'),
    moment = require('moment');

var LOG_DIR = __dirname + '/../../var/log';
var TMP_DIR = __dirname + '/../../var/tmp';
var LOG_LEVEL = process.env.DOGBOT_LOG_LEVEL;

winston.emitErrs = true;

// create log directory if it does not exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

if (LOG_LEVEL === undefined || LOG_LEVEL === null || !/(debug|info|warn|error)/i.test(LOG_LEVEL)) {
    LOG_LEVEL = 'info';
}

var timeFormat = function () {
    return moment().format('YYYY-MM-DDTHH:mm:ss,SSSZ');
};

var transports = [
    new winston.transports.DailyRotateFile({
        name: 'log', // http://stackoverflow.com/a/17374968
        level: LOG_LEVEL === 'debug' ? 'info' : LOG_LEVEL,
        filename: LOG_DIR + '/dogbot.log',
        json: false,
        colorize: false,
        zippedArchive: true,
        maxFiles: 8,
        timestamp: timeFormat
    }),
    new winston.transports.Console({
        level: LOG_LEVEL,
        json: false,
        colorize: true,
        timestamp: timeFormat
    })
];

if (LOG_LEVEL === 'debug') {
    transports.push(new winston.transports.DailyRotateFile({
        name: 'tmp', // http://stackoverflow.com/a/17374968
        level: LOG_LEVEL,
        filename: TMP_DIR + '/dogbot.log',
        json: false,
        colorize: false,
        zippedArchive: true,
        maxFiles: 2,
        timestamp: timeFormat
    }));
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