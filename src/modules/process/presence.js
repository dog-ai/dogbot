/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js');

function presence() {
    var moduleManager = {};
    var plotly = undefined;
}

presence.prototype.type = "PROCESS";

presence.prototype.name = "presence";

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.help = function () {
    var help = '';

    help += '*!presence* - _Show presence statistics_';

    return help;
};

presence.prototype.load = function (moduleManager, config) {
    this.moduleManager = moduleManager;

    var username = (config && config.auth && config.auth.username || undefined);
    if (username === undefined || username === null || username.trim() === '') {
        throw new Error('invalid configuration: no authentication username available');
    }

    var apiKey = (config && config.auth && config.auth.api_key || undefined);
    if (apiKey === undefined || apiKey === null || apiKey.trim() === '') {
        throw new Error('invalid configuration: no authentication API key available');
    }

    this.plotly = require('plotly')(username, apiKey);
};

presence.prototype.unload = function () {
};

presence.prototype.process = function (message, callback) {
    var self = this;

    if (message.substring(0, "!presence".length) === "!presence") {
        this._retrieveSample(function (samples) {
            var data = [
                {
                    x: samples.map(function (sample) {
                        return sample.date
                    }),
                    y: samples.map(function (sample) {
                        return sample.value
                    }),
                    type: "scatter"
                }
            ];
            var graphOptions = {filename: "date-axes", fileopt: "overwrite"};
            self.plotly.plot(data, graphOptions, function (err, msg) {
                callback(msg.url + '.png?' + Math.random());
            });
        });
    }
};

presence.prototype._retrieveSample = function (callback) {
    this.moduleManager.emit('database:stats:retrieveAll',
        "SELECT Datetime(date, 'localtime') as date, value FROM arp;", [],
        function (error, rows) {
            if (error !== undefined && error !== null) {
                logger.error(error.message);
            } else {
                callback(rows);
            }
        });
};

module.exports = new presence();
