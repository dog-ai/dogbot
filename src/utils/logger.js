/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var moment = require('moment');
var winston = require('winston');
winston.emitErrs = true;

var timeFormat = function () {
    return moment().format('YYYY-MM-DDTHH:mm:ssZ');
};

var logger = new winston.Logger({
    transports: [
        new winston.transports.DailyRotateFile({
            level: 'info',
            filename: __dirname + '../../../var/log/dogbot.log',
            handleExceptions: true,
            json: false,
            colorize: false,
            zippedArchive: true,
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