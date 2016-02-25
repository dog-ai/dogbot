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

    this.communication.on('nlp:intent:text', this._extractTextIntent);
};

wit.prototype.unload = function () {
    this.communication.removeListener('nlp:intent:text', this._extractTextIntent);
};

wit.prototype._extractTextIntent = function (text, callback) {
    client.captureTextIntent(instance._apiToken, text, function (error, response) {
        if (error) {
            if (callback) {
                callback(error);
            }
        } else {
            response.outcomes = _.sortBy(response.outcomes, ['confidence']);

            var outcome = response.outcomes && response.outcomes.length > 0 && response.outcomes[0];

            if (outcome.intent !== 'UNKNOWN' && outcome.confidence > 0.666) {
                if (outcome.metadata) {
                    callback(null, {event: outcome.metadata, entities: outcome.entities});
                } else {
                    callback(new Error('no intent metadata available'));
                }
            } else {
                callback(new Error('unable to extract intent from text'));
            }
        }

    });
};

var instance = new wit();

module.exports = instance;
