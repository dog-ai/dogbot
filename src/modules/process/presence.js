/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var nconf = require('nconf');

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

presence.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    nconf.env().argv();
    nconf.add('local', {type: 'file', file: __dirname + '/../../../conf/plotly.json'});

    var username = nconf.get('auth:username');
    if (username === undefined || username === null || username.trim() === '') {
        throw new Error('invalid configuration: no authentication username available');
    }

    var apiKey = nconf.get('auth:api_key');
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
        "SELECT Datetime(date, 'localtime'), value FROM arp;", [],
        function (error, rows) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                callback(rows);
            }
        });
};

module.exports = new presence();
