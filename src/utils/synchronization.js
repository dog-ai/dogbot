/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var fs = require('fs');

var synchronization = {
    configuration: {},
    databases: {},

    getConfigurations: function () {
        var self = this;

        var confDir = __dirname + '/../../var/conf/';
        fs.readdirSync(confDir).forEach(function (subDir) {
            var that = self;

            fs.readdirSync(confDir + subDir).forEach(function (file) {
                that.configuration[subDir] = (that.configuration[subDir] || {});
                that.configuration[subDir][file.replace('.json', '')] = JSON.parse(fs.readFileSync(confDir + subDir + '/' + file, 'utf8'));
            });
        });

        return this.configuration;
    },

    getDatabases: function () {
        var self = this;

        var confDir = __dirname + '/../../var/db/';
        fs.readdirSync(confDir).forEach(function (subDir) {
            var that = self;

            fs.readdirSync(confDir + subDir).forEach(function (file) {
                that.databases[subDir] = (that.databases[subDir] || {});
                that.databases[subDir][file.replace('.json', '')] = JSON.parse(fs.readFileSync(confDir + subDir + '/' + file, 'utf8'));
            });
        });

        return this.databases;
    },

    synchronizeDatabases: function (moduleManager) {
        this.databases = this.getDatabases();

        _.forEach(this.databases, function (database, databaseName) {
            _.forEach(database, function (rows, table) {
                _.forEach(rows, function (row) {
                    var columnNames = _.keys(row);
                    var values = _.values(row);

                    moduleManager.emit('database:' + databaseName + ':create',
                        'INSERT OR REPLACE INTO ' + table + ' (' + columnNames + ') VALUES (' + values.map(function () {
                            return '?'
                        }) + ')',
                        values,
                        function (error) {
                            if (error) {
                                throw error;
                            }
                        });
                });
            });
        });


    }
};

module.exports = synchronization;
