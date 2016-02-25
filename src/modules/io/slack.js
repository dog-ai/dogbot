/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    Promise = require('bluebird');

var RtmClient = require('slack-client').RtmClient,
    MemoryDataStore = require('slack-client').MemoryDataStore;

function slack() {
}

slack.prototype.type = "IO";

slack.prototype.name = "slack";

slack.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " I/O module_";
};

slack.prototype.load = function (communication, config) {
    this.communication = communication;

    this._apiToken = (config && config.api_token || undefined);
    if (!this._apiToken || this._apiToken.trim() === '') {
        throw new Error('invalid configuration: no API token available');
    }

    this.defaultChannel = (config && config.default_channel || undefined);

    this._dataStore = new MemoryDataStore({'logger': logger});

    this._client = new RtmClient(this._apiToken, {autoReconnect: true, dataStore: this._dataStore});

    return this.start();
};

slack.prototype.unload = function () {
    return this.stop();
};

slack.prototype.start = function () {
    return new Promise(function (resolve, reject) {
        instance._client.once('open', resolve);
        instance._client.once('unable_to_rtm_start', reject);

        instance._client.start();
    })
        .then(function () {
            instance._client.on('message', instance._onIncomingMessage);
            instance._client.on('presence_change', instance._onPresenceChange);

            instance.communication.on('io:slack:text:outgoing', instance._onOutgoingTextMessage);
        });
};

slack.prototype.stop = function () {
    return new Promise(function (resolve) {
        instance.communication.removeListener('io:slack:text:outgoing', instance._onOutgoingTextMessage);

        instance._client.removeListener('message', instance._onIncomingMessage);
        instance._client.removeListener('presence_change', instance._onPresenceChange);

        instance._client.once('disconnect', resolve);

        instance._client.disconnect();
    })
};

function replaceSlackIdsWithNames(text) {
    var _text = text;
    var ids = _text.match(/<@\w+>/g);

    _.forEach(ids, function (id) {
        var user = instance._dataStore.getUserById(id.substring(2, id.length - 1));
        if (user) {
            _text = text.replace(id, user.real_name || user.name);
        }
    });

    return _text
}

function removeBotName(text, botName) {
    var _text = text;

    if (botName.test(_text)) {
        if (_text.replace(botName, '').indexOf(': ') === 0) {
            _text = _text.replace(botName, '');
            _text = _text.substring(2)
        } else {
            _text = _text.replace(botName, 'you');
        }
    }

    return _text;
}

function findSlackUserFromEntities(entities) {
    var user;

    if (entities) {
        if (entities.contact && entities.contact.length > 0) {
            user = _.find(instance._dataStore.users, {real_name: entities.contact[0].value}) ||
                _.find(instance._dataStore.users, {name: entities.contact[0].value})
        }
    }

    return user;
}

slack.prototype._onIncomingMessage = function (message) {
    var type = message.type,
        channel = instance._dataStore.getChannelById(message.channel) || instance._dataStore.getDMById(message.channel),
        user = instance._dataStore.getUserById(message.user),
        time = message.ts,
        text = message.text;

    if (type === 'message' && text) {
        // replace slack ids with proper user names
        text = replaceSlackIdsWithNames(text);

        var bot = instance._dataStore.getUserById(instance._client.activeUserId);
        var botName = new RegExp('(' + bot.name + '|' + bot.real_name + ')', "i");

        // am i the message recipient or mentioned in it?
        if (channel.is_im || text.charAt(0) === '!' || botName.test(text)) {

            // normalize message by removing the bot name
            text = removeBotName(text, botName);

            instance._client.send({channel: channel.id, type: 'typing'});

            instance.communication.emitAsync('nlp:intent:text', text)
                .timeout(3000)
                .then(function (intent) {
                    return instance.communication.emitAsync(intent.event, intent.entities)
                        .timeout(1000)
                        .then(function (response) {
                            var text = response.text,
                                user = findSlackUserFromEntities(response.entities);

                            var channelId = user && instance._dataStore.getDMByName(user.name).id || channel.id;

                            instance._client.sendMessage(text, channelId);
                            instance._client.sendMessage(':+1:', channel.id);
                        })
                })
                .catch(function (error) {
                    instance._client.sendMessage('Not now! I\'m busy learning new tricks.', channel.id);
                });
        }
    }
};

slack.prototype._onPresenceChange = function (message) {
    logger.debug(message);
};


slack.prototype._onOutgoingTextMessage = function (message) {
    var channelId = message.channelId,
        text = message.text;

    instance._client.sendMessage(text, channelId);
};
/*
slack.prototype._discoverUsers = function () {
    var self = this;

    var channel = this.client.getChannelByName(this.defaultChannel.substring(1));
    var users = this._getUsersInChannel(channel);
    users.forEach(function (user) {
        if (user.presence === 'active') {
 self.communication.emit('io:slack:userIsAlreadyActive', user);
        } else {
 self.communication.emit('io:slack:userIsAlreadyAway', user);
        }
    });
};

slack.prototype._listenUserPresence = function (user, presence) {
 var channel = this._client.getChannelByName(this.defaultChannel.substring(1));
    if (this._isUserInChannel(user, channel)) {
        switch (presence) {
            case 'active':
 this.communication.emit('io:slack:userIsNowActive', user);
                break;
            case 'away':
 this.communication.emit('io:slack:userIsNowAway', user);
                break;
        }
    }
 };*/

var instance = new slack();

module.exports = instance;
