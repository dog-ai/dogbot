/*
 * Copyright (C) 2016 dog.ai, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
    _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    Promise = require('bluebird');

var APPS_DIR = path.join(__dirname, '/');

function apps() {
}

apps.prototype.enableApp = function (name, config) {
    var self = this;

    if (_.find(this.enabled, {name: name}) || !_.contains(this.available, name)) {
        return;
    }

    var app = require(APPS_DIR + name);
    var promises = [];

    _.forEach(app.databases, function (database) {
        promises.push(self.databases.startDatabase(database.type, database.name));
    });

    return Promise.all(promises)
        .then(function () {

            promises = [];

            _.forEach(app.modules, function (module) {
                promises.push(self.modules.loadModule(module.type, module.name, module.optional, config));
            });

            return Promise.all(promises);
        })
        .then(function () {
            self.enabled.push(app);

            logger.info('Enabled app: ' + app.name);
        })
        .catch(function (error) {

            promises = [];

            _.forEach(app.databases, function (database) {
                promises.push(self.databases.stopDatabase(database.type, database.name));
            });

            _.forEach(app.modules, function (module) {
                promises.push(self.modules.unloadModule(module.name));
            });

            logger.error('Unable to enable app ' + name + ' because ' + error.message);

            return Promise.all(promises);
        });
};

apps.prototype.disableApp = function (name) {
    var self = this;

    var app = _.find(this.enabled, {name: name});

    if (!app) {
        return;
    }

    var promises = [];

    _.forEach(app.modules, function (module) {
        promises.push(self.modules.unloadModule(module.name));
    });

    return Promise.all(promises)
        .then(function () {
            promises = [];

            _.forEach(app.databases, function (database) {
                promises.push(self.databases.stopDatabase(database.type, database.name));
            });

            return Promise.all(promises);
        })
        .then(function () {
            _.remove(self.enabled, {name: name});

            logger.info('Disabled app: ' + name);
        }).catch(function (error) {
            logger.info('Unable to disable app ' + name + ' because ' + error.message);
        });
};

apps.prototype.disableAllApps = function () {
    var self = this;

    var promises = [];

    _.forEach(this.enabled, function (app) {
        promises.push(self.disableApp(app.name));
    });

    return Promise.all(promises);
};

apps.prototype.healthCheck = function () {
    return Promise.resolve();
};

module.exports = function (communication, modules, databases) {
    var instance = new apps();

    instance.modules = modules;
    instance.databases = databases;
    instance.enabled = [];
    instance.available = (fs.readdirSync(APPS_DIR) || [])
        .filter(function (file) {
            return (file.indexOf('index') == -1);
        })
        .map(function (file) {
            return file.replace('.js', '');
        });

    return instance;
};
