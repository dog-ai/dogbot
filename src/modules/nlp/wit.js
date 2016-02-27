/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash');

var LowConfidence = require('./errors/low-confidence'),
    UnknownIntent = require('./errors/unknown-intent');

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

    this._apiToken = config && config.api_token;
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
            callback(error);
        } else {
            var outcome = _.head(_.sortBy(response.outcomes, ['confidence']));

            if (outcome.intent === 'UNKNOWN') {
                callback(new UnknownIntent());
            } else if (outcome.confidence < 0.8) {
                callback(new LowConfidence(outcome.confidence));
            } else {
                callback(null, {
                    event: outcome.metadata,
                    entities: outcome.entities
                });
            }
        }

    });
};

var instance = new wit();

module.exports = instance;
