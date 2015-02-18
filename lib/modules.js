/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var path = require('path');
var fs = require("fs");

var modules = {

    loaded: [],

    available: [],

    types: ['SCHEDULE', 'PROCESS', 'MONITOR', 'IO'],

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
            module.load(this);
            console.log('Loaded ' + type.toLowerCase() + ' module: ' + module.name);
        } catch (exception) {
            console.log('Unable to load ' + type.toLowerCase() + ' module ' + file + ' because ' + exception.message);
            this.available.push(module);
        }
    },

    unloadAll: function() {
       var that = this;
        this.types.reverse().forEach(function(type) {
            that._unloadAllByType(type);
        });
    },

    _unloadAllByType: function(type) {
        var that = this;
        this.findAllLoadedModulesByType(type).forEach(function(module) {
            that._unload(module);
        });
    },

    unloadModule: function(module) {
        this._unload(module);
    },

    _unload: function(module) {
        try {
            module.unload();
            console.log('Unloaded ' + module.type.toLowerCase() + ' module: ' + module.name);
        } catch (exception) {
            console.log('Unable to unload ' + module.type.toLowerCase() + ' module ' + module.name + ' because ' + exception.message);
        }
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
