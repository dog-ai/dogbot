/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var winston = require('winston'),
    fs = require('fs'),
    moment = require('moment');

var LOG_DIR = __dirname + '/../../var/log';

winston.emitErrs = true;

// create log directory if it does not exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

var timeFormat = function () {
    return moment().format('YYYY-MM-DDTHH:mm:ss,SSSZ');
};

var logger = new winston.Logger({
    transports: [
        new winston.transports.DailyRotateFile({
            level: 'info',
            filename: LOG_DIR + '/dogbot.log',
            handleExceptions: true,
            json: false,
            colorize: false,
            zippedArchive: true,
            timestamp: timeFormat
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: timeFormat
        })
    ],
    exitOnError: false
});

module.exports = logger;
module.exports.stream = {
    write: function (message, encoding) {
        logger.info(message);
    }
};