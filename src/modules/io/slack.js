/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var events = require('events');
var Slack = require('slack-client');

function slack() {
    var client = {};
    var authToken;
    var autoReconnect = true;
    var autoMark = true;
    var defaultChannel = undefined;
    var discoverInterval = undefined;

    events.EventEmitter.call(this);
}

slack.prototype.__proto__ = events.EventEmitter.prototype;

slack.prototype.type = "IO";

slack.prototype.name = "slack";

slack.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " I/O module_";
};

slack.prototype.load = function (moduleManager, config) {
    this.moduleManager = moduleManager;

    this.authToken = (config && config.auth && config.auth.token || undefined);
    if (this.authToken === undefined || this.authToken === null || this.authToken.trim() === '') {
        throw new Error('invalid configuration: no authentication token available');
    }

    this.defaultChannel = (config && config.default_channel || undefined);

    this.client = new Slack(this.authToken, this.autoReconnect, this.autoMark);

    this.start();
};

slack.prototype.unload = function () {
    this.stop();
};

slack.prototype.start = function () {
    var self = this;

    this.discoverInterval = setInterval(function () {
        try {
            self._discoverUsers();
        } catch (error) {
            console.error(error);
        }
    }, 60 * 1000);

    this.client.on('open', function () {
    });

    this.client.on('close', function () {

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
    clearInterval(this.discoverInterval);
};

slack.prototype.send = function(recipient, message) {

    if (recipient === null) {
        return this.send(this.defaultChannel, message);
    } else if (recipient.charAt(0) === '#') {
        var channel = this.client.getChannelByName(recipient.substring(1));
        channel.send(message);
    } else if (recipient.charAt(0) === 'D') {
        var id = this.client.getChannelGroupOrDMByID(recipient);
        id.send(message);
    } else if (recipient.charAt(0) === 'U') {
        var self = this;

        this.client.openDM(recipient, function (dm) {
            if (dm !== undefined && dm !== null && dm.channel.id !== null) {
                self.send(dm.channel.id, message);
            }
        });
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
                }, user);
            } catch (exception) {
                channel.send("Oops! Something went wrong...please call the maintenance team!");
                console.log(exception.stack);
            }
        });
    }
};

slack.prototype._discoverUsers = function () {
    var self = this;

    var channel = this.client.getChannelByName(this.defaultChannel.substring(1));
    var users = this._getUsersInChannel(channel);
    users.forEach(function (user) {
        if (user.presence === 'active') {
            self.moduleManager.emit('io:slack:userIsAlreadyActive', user);
        } else {
            self.moduleManager.emit('io:slack:userIsAlreadyAway', user);
        }
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
};

module.exports = new slack();
