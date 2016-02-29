/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
    _ = require('lodash'),
    path = require('path'),
    fs = require("fs"),
    Promise = require('bluebird');

var MODULES_DIR = path.join(__dirname, '/');

function modules() {
}

modules.prototype.loadModule = function (type, name, optional, config, reload) {
    var self = this;


    reload = reload || false;

    var module = _.find(this.loaded, {name: name});

    if (module) {
        if (!reload) {
            return;
        }

        return this._unload(module)
            .then(function () {
                return self._load(type, name, optional, config);
            });
    } else {
        return this._load(type, name, optional, config);
    }
};

modules.prototype.unloadModule = function (name) {
    var module = _.find(this.loaded, {name: name});

    if (!module) {
        return;
    }

    this._unload(module);
};

modules.prototype._load = function (type, name, optional, config) {
    var self = this;

    return new Promise(function (resolve, reject) {

        if (config && !config.is_enabled) {
            return;
        }

        // TODO: need to rewrite with promises instead
        _.defer(function () {
            try {
                var module;
                try {
                    module = require('./' + type.toLowerCase() + '/' + name + '.js');
                } catch (error) {
                    module = require('./' + type.toLowerCase() + '/' + name);
                }

                module.load(self.communication, config);

                self.loaded.push(module);

                logger.debug('Loaded ' + type.toLowerCase() + ' module: ' + module.name);

                resolve();
            } catch (error) {

                if (!(error.message.indexOf('platform is not supported') > -1 ||
                    error.message.indexOf('invalid configuration') > -1 ||
                    error.message.indexOf('unix socket not available') > -1)) {
                    logger.error(error.stack);
                }

                if (optional) {
                    logger.debug('Unable to load optional ' + type.toLowerCase() + ' module ' + name + ' because ' + error.message);

                    resolve();
                } else {
                    reject(new Error('unable to load' + type.toLowerCase() + ' module ' + name));
                }
            }
        });
    });
};

modules.prototype._unload = function(module) {
    var self = this;

    return new Promise(function (resolve, reject) {
        try {
            module.unload();

            try {
                delete require.cache[require.resolve('./' + module.type.toLowerCase() + '/' + module.name + '.js')];
            } catch (error) {
                delete require.cache[require.resolve('./' + module.type.toLowerCase() + '/' + module.name)];
            }

            _.remove(self.loaded, function (_module) {
                return _module.name == module.name;
            });

            logger.debug('Unloaded ' + module.type.toLowerCase() + ' module: ' + module.name);

            resolve();
        } catch (error) {
            logger.debug('Unable to unload ' + module.type.toLowerCase() + ' module ' + module.name + ' because ' + error.message);

            reject('unable to unload ' + module.type.toLowerCase() + ' module ' + module.name);
        }
    });
};

module.exports = function (communication) {
    var instance = new modules();

    instance.communication = communication;
    instance.loaded = [];
    instance.available = [];

    instance.types = (fs.readdirSync(MODULES_DIR) || []).map(function (type) {
        return type.toUpperCase();
    });

    return instance;
};
