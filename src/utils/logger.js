/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var winston = require('winston'),
    fs = require('fs'),
    moment = require('moment'),
    path = require('path');

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
        timestamp: timeFormat,
        handleExceptions: true
    }),
    new winston.transports.Console({
        level: LOG_LEVEL,
        json: false,
        colorize: true,
        timestamp: timeFormat,
        handleExceptions: true
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

// A custom logger interface that wraps winston, making it easy to instrument code

module.exports.debug = module.exports.log = function () {
    logger.debug.apply(logger, formatLogArguments(arguments))
};

module.exports.info = function () {
    logger.info.apply(logger, formatLogArguments(arguments))
};

module.exports.warn = function () {
    logger.warn.apply(logger, formatLogArguments(arguments))
};

module.exports.error = function () {
    logger.error.apply(logger, formatLogArguments(arguments))
};

/**
 * Attempts to add file and line number info to the given log arguments.
 */
function formatLogArguments(args) {
    args = Array.prototype.slice.call(args);

    var stackInfo = getStackInfo(1);

    if (stackInfo) {
        // get file path relative to project root
        var calleeStr = '(' + stackInfo.relativePath + ':' + stackInfo.line + ')';

        if (typeof (args[0]) === 'string') {
            args[0] = calleeStr + ' ' + args[0]
        } else {
            args.unshift(calleeStr)
        }
    }

    return args
}

/**
 * Parses and returns info about the call stack at the given index.
 */
function getStackInfo(stackIndex) {
    // get call stack, and analyze it
    // get all file, method, and line numbers
    var stacklist = (new Error()).stack.split('\n').slice(3);

    // stack trace format:
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
    var stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi;
    var stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi;

    var s = stacklist[stackIndex] || stacklist[0];
    var sp = stackReg.exec(s) || stackReg2.exec(s);

    if (sp && sp.length === 5) {
        return {
            method: sp[1],
            relativePath: path.relative(__dirname + '/../', sp[2]),
            line: sp[3],
            pos: sp[4],
            file: path.basename(sp[2]),
            stack: stacklist.join('\n')
        }
    }
}

module.exports.stream = {
    write: function (message, encoding) {
        logger.info(message);
    }
};