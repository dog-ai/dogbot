/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var path = require('path');
var fs = require("fs");

var CronJob = require('cron').CronJob;

var modules = {

    loaded: [],

    available: [],

    types: ['IO', 'MONITOR', 'PROCESS', 'SCHEDULE'],

    bootstraps: {
        IO: function(module, moduleManager) {
            module.moduleManager = moduleManager;
            module.on('message:received', function(message, callback) {
                moduleManager.findAllLoadedModulesByType('PROCESS').forEach(function(module) {
                    try {
                        module.process(message, callback);
                    } catch(exception) {
                        callback("Oops! Something went wrong...please call the maintenance team!");
                        console.log(exception);
                    }
                });
            });
        },
        MONITOR: function(module) {
            module.start();
        },
        PROCESS: function(module, moduleManager) {
            module.moduleManager = moduleManager;
        },
        SCHEDULE: function(module, moduleManager) {
            module.moduleManager = moduleManager;
            new CronJob(module.cron, function() {
                try {
                    module.schedule();
                } catch (exception) {
                    console.log(exception);
                    console.log('Unable to run schedule');
                }
            }, null, true, "Europe/Stockholm");
        }
    },

    loadAll: function() {
        var that = this;
        this.types.forEach(function(type) {
            that._loadAllByType(type);
        });
    },

    _loadAllByType: function(type) {
        var dir = path.join(__dirname, 'modules/' + type.toLowerCase());
        var that = this;
        fs.readdirSync(dir).forEach(function(file) {
            that._load(type, file);
        });
    },

    loadModule: function(file) {

    },

    _load: function(type, file) {
        if (file.charAt(0) === '.') {
            return;
        }

        try {
            var module = require('./modules/' + type.toLowerCase() + '/' + file);
            this.loaded.push(module);

            this.bootstraps[type](module, this);

            console.log('Loaded ' + type.toLowerCase() + ' module: ' + module.name);
        } catch (exception) {
            console.error(exception);
            console.log('Unable to load ' + type.toLowerCase() + ' module: ' + file);
            this.available.push(module);
        }
    },

    unloadModule: function(file) {

    },

    findAllLoadedModulesByType: function(type) {
        var modules = [];
        this.loaded.forEach(function(module) {
            if (type === module.type) {
                modules.push(module);
            }
        });
        return modules;
    },

    findLoadedModuleByName: function(name) {
        var module = undefined;
        this.loaded.forEach(function(_module) {
            if (name === _module.name) {
                module = _module;
            }
        });
        return module;
    }
};

module.exports = modules;
