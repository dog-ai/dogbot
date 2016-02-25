/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function slap() {
    var communication = {};
}

slap.prototype.type = "ACTION";

slap.prototype.name = "slap";

slap.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

slap.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

slap.prototype.unload = function () {
    this.stop();
};

slap.prototype.start = function () {
    this.communication.on('action:slap', this._slap);
};

slap.prototype.stop = function () {
    this.communication.removeListener('action:slap', this._slap);
};

slap.prototype._slap = function (entities, callback) {
    /*if (message.substring(0, "!slap".length) === "!slap") {
        var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

        if (fields !== null && fields.length == 2 && fields[1].charAt(0) === '<') {
            var slackId = fields[1].substring(2, fields[1].length - 1);

     this.communication.findAllLoadedModulesByType('IO').forEach(function (module) {
                if (module.name === 'slack') {
                    module.send(slackId, 'https://mikemcclaughry.files.wordpress.com/2012/09/slapping-hand.jpg?' + Math.random());
                }
            });
        }
    } else if (message.substring(0, "!hi5".length) === "!hi5") {
        var fields = message.replace(/(“|”)/g, '"').match(/(?:[^\s"]+|"[^"]*")+/g);

        if (fields !== null && fields.length == 2 && fields[1].charAt(0) === '<') {
            var slackId = fields[1].substring(2, fields[1].length - 1);

     this.communication.findAllLoadedModulesByType('IO').forEach(function (module) {
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
     }*/

    callback(null, {
        text: 'https://mikemcclaughry.files.wordpress.com/2012/09/slapping-hand.jpg?' + Math.random(),
        entities: entities
    });
};

module.exports = new slap();
