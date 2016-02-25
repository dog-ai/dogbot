/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash');

var client = require('node-wit');

function wit() {
}

wit.prototype.type = "NLP";

wit.prototype.name = "wit";

wit.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " NLP module_";
};

wit.prototype.load = function (communication, config) {
    this.communication = communication;

    this._apiToken = (config && config.api_token || undefined);
    if (!this._apiToken || this._apiToken.trim() === '') {
        throw new Error('invalid configuration: no api token available');
    }

    this.communication.on('io:slack:text:incoming', this._processText);
};

wit.prototype.unload = function () {
    this.communication.removeListener('io:slack:text:incoming', this._processText);
};

wit.prototype._processText = function (text, callback) {
    client.captureTextIntent(instance._apiToken, text, function (error, response) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            logger.debug(JSON.stringify(response));

            if (callback) {
                callback();
            }
        }

    });
};

var instance = new wit();

module.exports = instance;
