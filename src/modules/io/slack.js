/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var events = require('events');
var nconf = require('nconf');
var Slack = require('slack-client');

function slack() {
    var client = {};
    var authToken;
    var autoReconnect = true;
    var autoMark = true;

    events.EventEmitter.call(this);
}

slack.prototype.__proto__ = events.EventEmitter.prototype;

slack.prototype.type = "IO";

slack.prototype.name = "slack";

slack.prototype.info = function() {
    return "*" + this.name + "* - _Slack I/O module_";
}

slack.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    nconf.env().argv();
    nconf.add('local', {type: 'file', file: __dirname + '/../../../conf/slack.json'});

    this.authToken = nconf.get('auth:token');
    if (this.authToken === undefined || this.authToken === null || this.authToken.trim() === '') {
        throw new Error('invalid configuration: no authentication token available');
    }

    var that = this;
    this.on('message:received', function(message, callback) {
        that.moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function(module) {
            try {
                module.process(message, callback);
            } catch (exception) {
                callback("Oops! Something went wrong...please call the maintenance team!");
                console.log(exception);
            }
        });
    });

    this.client = new Slack(this.authToken, this.autoReconnect, this.autoMark);

    this.client.on('open', function() {});

		var that = this;
    this.client.on('message', function(message) {
        var type = message.type,
            channel = that.client.getChannelGroupOrDMByID(message.channel),
            user = that.client.getUserByID(message.user),
            time = message.ts,
            text = message.text;

        if (text !== undefined && text.charAt(0) === '!') {
            that.emit('message:received', text, function(response) {
                channel.send(response);
            });
        }
    });

    this.client.on('error', function(error) {
        console.error('Error: %s', error);
    });

    this.client.login();
}

slack.prototype.unload = function() {}

slack.prototype.send = function(recipient, message) {

    if (recipient === null) {
        return this.send(nconf.get('default_channel'), message);
    } else if (recipient.charAt(0) === '#') {
        var channel = this.client.getChannelByName(recipient.substring(1));
        channel.send(message);
    } else {
        var id = this.client.getChannelGroupOrDMByID(recipient);
        id.send(message);
    }
}

module.exports = new slack();
