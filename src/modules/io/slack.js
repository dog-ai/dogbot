/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var events = require('events');
var nconf = require('nconf');
var Slack = require('slack-client');

function slack() {
    var client = {};
    var authToken;
    var autoReconnect = true;
    var autoMark = true;
    var defaultChannel = undefined;

    events.EventEmitter.call(this);
}

slack.prototype.__proto__ = events.EventEmitter.prototype;

slack.prototype.type = "IO";

slack.prototype.name = "slack";

slack.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

slack.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    nconf.env().argv();
    nconf.add('local', {type: 'file', file: __dirname + '/../../../conf/slack.json'});

    this.authToken = nconf.get('auth:token');
    if (this.authToken === undefined || this.authToken === null || this.authToken.trim() === '') {
        throw new Error('invalid configuration: no authentication token available');
    }

    this.defaultChannel = nconf.get('default_channel');

    this.client = new Slack(this.authToken, this.autoReconnect, this.autoMark);

    this.start();
};

slack.prototype.unload = function () {
    this.stop();
};

slack.prototype.start = function () {
    var self = this;

    this.client.on('open', function () {
        self._discoverActiveUsers();
    });

    this.client.on('close', function () {
        console.log('closed slack');
    });

    this.client.on('message', function(message) {
        self._handleMessage(message);
    });

    this.client.on('presenceChange', function (user, presence) {
        self._listenUserPresence(user, presence);
    });

    this.client.on('error', function(error) {
        throw error;
    });

    this.client.login();
};

slack.prototype.stop = function () {

};

slack.prototype.send = function(recipient, message) {

    if (recipient === null) {
        return this.send(this.defaultChannel, message);
    } else if (recipient.charAt(0) === '#') {
        var channel = this.client.getChannelByName(recipient.substring(1));
        channel.send(message);
    } else {
        var id = this.client.getChannelGroupOrDMByID(recipient);
        id.send(message);
    }
};

slack.prototype._handleMessage = function (message) {
    var type = message.type,
        channel = this.client.getChannelGroupOrDMByID(message.channel),
        user = this.client.getUserByID(message.user),
        time = message.ts,
        text = message.text;

    if (text !== undefined && text.charAt(0) === '!') {
        this.moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function (module) {
            try {
                module.process(text, function (response) {
                    channel.send(response);
                });
            } catch (exception) {
                channel.send("Oops! Something went wrong...please call the maintenance team!");
                console.log(exception.stack);
            }
        });
    }
};

slack.prototype._discoverActiveUsers = function () {
    var self = this;

    var channel = this.client.getChannelByName(this.defaultChannel.substring(1));
    var activeUsers = this._getActiveUsersInChannel(channel);
    activeUsers.forEach(function (user) {
        self.moduleManager.emit('io:slack:userIsAlreadyActive', user);
    });
};

slack.prototype._listenUserPresence = function (user, presence) {
    var channel = this.client.getChannelByName(this.defaultChannel.substring(1));
    if (this._isUserInChannel(user, channel)) {
        switch (presence) {
            case 'active':
                this.moduleManager.emit('io:slack:userIsNowActive', user);
                break;
            case 'away':
                this.moduleManager.emit('io:slack:userIsNowAway', user);
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

slack.prototype._getActiveUsersInChannel = function (channel) {
    if (!channel) {
        return [];
    }

    var self = this;
    return (channel.members || [])
        .map(function (id) {
            return self.client.users[id];
        })
        .filter(function (u) {
            return !!u && !u.is_bot && u.presence === 'active';
        });
};

module.exports = new slack();
