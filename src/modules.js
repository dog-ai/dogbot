/*
 * Copyright (C) 2015 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash');
var path = require('path');
var fs = require("fs");

var modulesDir = path.join(__dirname, 'modules/');

function modules() {
}

modules.prototype.loadAll = function (configs) {
    var self = this;

    this.types.forEach(function(type) {
        self._loadAllByType(type, configs && configs[type.toLowerCase()] || undefined);
    });
};

modules.prototype._loadAllByType = function (type, configs) {
    var that = this;

    var dir = path.join(modulesDir + type.toLowerCase());

    fs.readdirSync(dir).forEach(function(file) {
        that._load(type, file, configs && configs[file.replace('.js', '')] || undefined);
    });
};

modules.prototype.loadModule = function (type, moduleName, config, reload) {
    reload = reload || false;

    var loadedModule = this.findLoadedModuleByName(moduleName);
    if (loadedModule) {
        if (!reload) {
            return;
        }

        this._unload(loadedModule);
    }

    this._load(type, moduleName + '.js', config);
};

modules.prototype._load = function (type, file, config) {
    var self = this;

    if (file.charAt(0) === '.' || (config && !config.is_enabled)) {
        return;
    }

    _.defer(function () {
        try {
            var module = require('./modules/' + type.toLowerCase() + '/' + file);

            module.load(self.communication, config);

            self.loaded.push(module);

            console.log('Loaded ' + type.toLowerCase() + ' module: ' + module.name);
        } catch (error) {
            console.log('Unable to load ' + type.toLowerCase() + ' module ' + file + ' because ' + error.message);
            if (!(error.message.indexOf('platform is not supported') > -1 ||
                error.message.indexOf('invalid configuration') > -1)) {
                console.error(error.stack);
            }
        }
    });
};

modules.prototype.unloadAll = function() {
    var self = this;
    this.types.reverse().forEach(function(type) {
        self._unloadAllByType(type);
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

        delete require.cache[require.resolve('./modules/' + module.type.toLowerCase() + '/' + module.name + '.js')];

        _.remove(this.loaded, function (_module) {
            return _module.name == module.name;
        });

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
    var module = null;
    this.loaded.forEach(function(_module) {
        if (name === _module.name) {
            module = _module;
        }
    });
    return module;
};

module.exports = function (communication) {
    var instance = new modules();

    instance.communication = communication;
    instance.loaded = [];
    instance.available = [];

    instance.types = (fs.readdirSync(modulesDir) || []).map(function (type) {
        return type.toUpperCase();
    });

    return instance;
};
