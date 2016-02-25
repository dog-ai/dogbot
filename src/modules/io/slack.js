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

slack.prototype._onIncomingMessage = function (message) {
    var type = message.type,
        channel = instance._dataStore.getChannelById(message.channel) || instance._dataStore.getDMById(message.channel),
        user = instance._dataStore.getUserById(message.user),
        time = message.ts,
        text = message.text;

    if (type === 'message' && text) {

        var me = instance._dataStore.getUserById(instance._client.activeUserId);

        // replace slack user ids with proper meaningful names
        var userIds = text.match(/<@\w+>/g);
        _.forEach(userIds, function (userId) {
            var user = instance._dataStore.getUserById(userId.substring(2, userId.length - 1));
            if (user) {
                text = text.replace(userId, user.real_name || user.name);
            }
        });

        // am i the message recipient or mentioned in it?
        var name = new RegExp('(' + me.name + '|' + me.real_name + ')', "i");
        if (channel.is_im || text.charAt(0) === '!' || name.test(text)) {

            // normalize message by removing the bot name
            if (name.test(text)) {
                if (text.replace(name, '').indexOf(': ') === 0) {
                    text = text.replace(name, '');
                    text = text.substring(2, text.length - 1)
                } else {
                    text = text.replace(name, 'you');
                }
            }

            instance._client.send({
                channel: channel.id,
                type: 'typing'
            });

            instance.communication.emitAsync('nlp:intent:text', text)
                .timeout(3000)
                .then(function (intent) {
                    return instance.communication.emitAsync(intent.event, intent.entities)
                        .timeout(1000)
                        .then(function (response) {
                            var text = response.text,
                                entities = response.entities;

                            var user;
                            if (entities) {
                                if (entities.contact && entities.contact.length > 0) {
                                    user = _.find(instance._dataStore.users, {real_name: entities.contact[0].value}) ||
                                        _.find(instance._dataStore.users, {name: entities.contact[0].value})
                                }
                            }

                            var channelId = user && instance._dataStore.getDMByName(user.name).id || channel.id;

                            instance._client.sendMessage(text, channelId);
                            instance._client.sendMessage(':+1:', channel.id);
                        })
                })
                .catch(function (error) {
                    logger.error(error);
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
};

slack.prototype._isUserInChannel = function (user, channel) {
    if (!user || !channel) {
        return false;
    }

    return !_.findIndex((channel.members || []), function (id) {
        return user.id == id;
    });
};

slack.prototype._getUsersInChannel = function (channel) {
    if (!channel) {
        return [];
    }

    var self = this;
    return (channel.members || [])
        .map(function (id) {
            return self.client.users[id];
        })
        .filter(function (u) {
            return !!u && !u.is_bot;
        });
 };*/

var instance = new slack();

module.exports = instance;
