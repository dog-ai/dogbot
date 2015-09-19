/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var events = require('events');
var readline = require('readline');

function stdin() {
    events.EventEmitter.call(this);
}

stdin.prototype.__proto__ = events.EventEmitter.prototype;

stdin.prototype.type = "IO";

stdin.prototype.name = "stdin";

stdin.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " I/O module_";
};

stdin.prototype.load = function(moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    var rl = readline.createInterface({
        input: process.stdin,
        terminal: false
    });

    rl.on('line', function (message) {

        if (message.charAt(0) === '!') {


            self.moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function (module) {
                try {
                    module.process(message, function (data) {
                        console.log(data);
                    });
                } catch (exception) {
                    console.log("Oops! Something went wrong...please call the maintenance team!");
                    console.log(exception);
                }
            });

        }
    })

};

stdin.prototype.unload = function() {
};

stdin.prototype.send = function(recipient, message) {
};

module.exports = new stdin();
