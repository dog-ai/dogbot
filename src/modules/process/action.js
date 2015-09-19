/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function action() {
    var moduleManager = {};
}

action.prototype.type = "PROCESS";

action.prototype.name = "action";

action.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

action.prototype.help = function () {
    var help = '';

    help += '*!slap* <slack id> - _Tell me to slap someone_\n';
    help += '*!hi5* <slack id> - _Tell me to hi5 someone_\n';

    return help;
};

action.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;

    this.start();
};

action.prototype.unload = function () {
    this.stop();
};

action.prototype.start = function () {

};

action.prototype.stop = function () {

};

action.prototype.process = function (message, callback, user) {
    if (message.substring(0, "!slap".length) === "!slap") {
        var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

        if (fields !== null && fields.length == 2 && fields[1].charAt(0) === '<') {
            var slackId = fields[1].substring(2, fields[1].length - 1);

            this.moduleManager.findAllLoadedModulesByType('IO').forEach(function (module) {
                if (module.name === 'slack') {
                    module.send(slackId, 'https://mikemcclaughry.files.wordpress.com/2012/09/slapping-hand.jpg?' + Math.random());
                }
            });
        }
    } else if (message.substring(0, "!hi5".length) === "!hi5") {
        var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

        if (fields !== null && fields.length == 2 && fields[1].charAt(0) === '<') {
            var slackId = fields[1].substring(2, fields[1].length - 1);

            this.moduleManager.findAllLoadedModulesByType('IO').forEach(function (module) {
                if (module.name === 'slack') {

                    var image = undefined;
                    if (slackId === user.id) {
                        image = 'http://media2.giphy.com/media/cJgkhpLgsuTkY/giphy.gif?' + Math.random();
                    } else {
                        image = 'http://cdn.worldcupblog.org/croatia.worldcupblog.org/files/2009/11/highfive.png?' + Math.random();
                    }

                    module.send(slackId, image);
                }
            });
        }
    }
};

module.exports = new action();
