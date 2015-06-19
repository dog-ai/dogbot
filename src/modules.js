/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var events = require('events');
var path = require('path');
var fs = require("fs");

function modules() {
    events.EventEmitter.call(this);
};

modules.prototype.__proto__ = events.EventEmitter.prototype;

modules.prototype.loadAll = function() {
    var that = this;
    this.types.forEach(function(type) {
        that._loadAllByType(type);
    });
};

modules.prototype._loadAllByType = function(type) {
    var dir = path.join(__dirname, 'modules/' + type.toLowerCase());
    var that = this;
    fs.readdirSync(dir).forEach(function(file) {
        that._load(type, file);
    });
};

modules.prototype.loadModule = function(file) {

};

modules.prototype._load = function(type, file) {
    if (file.charAt(0) === '.') {
        return;
    }

    try {
        var module = require('./modules/' + type.toLowerCase() + '/' + file);

        module.load(this);

        this.loaded.push(module);
        console.log('Loaded ' + type.toLowerCase() + ' module: ' + module.name);
    } catch (error) {
        console.log('Unable to load ' + type.toLowerCase() + ' module ' + file + ' because ' + error.message);
        if (!(error.message.indexOf('platform is not supported') > -1)) {
            console.error(error.stack);
        }
        this.available.push(module);
    }
};

modules.prototype.unloadAll = function() {
    var that = this;
    this.types.reverse().forEach(function(type) {
        that._unloadAllByType(type);
    });
};

modules.prototype._unloadAllByType = function(type) {
    var that = this;
    this.findAllLoadedModulesByType(type).forEach(function(module) {
        that._unload(module);
    });
};

modules.prototype.unloadModule = function(module) {
    this._unload(module);
};

modules.prototype._unload = function(module) {
    try {
        module.unload();
        console.log('Unloaded ' + module.type.toLowerCase() + ' module: ' + module.name);
    } catch (exception) {
        console.log('Unable to unload ' + module.type.toLowerCase() + ' module ' + module.name + ' because ' + exception.message);
    }
};

modules.prototype.findAllLoadedModulesByType = function(type) {
    var modules = [];
    this.loaded.forEach(function(module) {
        if (type === module.type) {
            modules.push(module);
        }
    });
    return modules;
};

modules.prototype.findLoadedModuleByName = function(name) {
    var module = undefined;
    this.loaded.forEach(function(_module) {
        if (name === _module.name) {
            module = _module;
        }
    });
    return module;
};

var instance = new modules();

instance.loaded = [];
instance.available = [];
instance.types = ['DATABASE', 'SCHEDULE', 'PROCESS', 'MONITOR', 'IO', 'AUTH']

module.exports = instance;
