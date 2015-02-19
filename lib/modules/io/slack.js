/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var events = require('events');

function slack() {
    var client = {};

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
}

slack.prototype.unload = function() {}

slack.prototype.send = function(recipient, message) {

console.log("aqui");
    if (recipient.charAt(0) === '#') {
        console.log("aqui2");

        var channel = this.client.getChannelByName("feedeo");
        channel.send(message);
    } else {
        console.log("aqui3");

        var id = this.client.getChannelGroupOrDMByID(recipient);
        id.send(message);
    }
}

var instance = new slack();

var Slack = require('slack-client');

var token = 'xoxb-3691534247-A6d2bMOL1WSf8iu7OeGxDH9y',
    autoReconnect = true,
    autoMark = true;

instance.client = new Slack(token, autoReconnect, autoMark);

instance.client.on('open', function() {});

instance.client.on('message', function(message) {
    var type = message.type,
        channel = instance.client.getChannelGroupOrDMByID(message.channel),
        user = instance.client.getUserByID(message.user),
        time = message.ts,
        text = message.text;

    if (text !== undefined && text.charAt(0) === '!') {
        instance.emit('message:received', text, function(response) {
            channel.send(response);
        });
    }
});

instance.client.on('error', function(error) {
    console.error('Error: %s', error);
});

instance.client.login();

module.exports = instance;
