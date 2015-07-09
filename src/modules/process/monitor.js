/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function monitor() {
    var moduleManager = {};
}

monitor.prototype.type = "PROCESS";

monitor.prototype.name = "monitor";

monitor.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

monitor.prototype.help = function () {
    var help = '';

    help += '*!monitor arp list* - _List monitored ARP entries_';
    help += '*!monitor ip list* - _List monitored IP addresses_';
    help += '*!monitor bonjour list* - _List monitored Bonjour services_';

    return help;
};

monitor.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;
};

monitor.prototype.unload = function () {
};

monitor.prototype.process = function (message, callback) {
    if (message.substring(0, "!monitor arp list".length) === "!monitor arp list") {
        this._retrieveArp(callback);
    } else if (message.substring(0, "!monitor ip list".length) === "!monitor ip list") {
        this._retrieveIp(callback);
    } else if (message.substring(0, "!monitor bonjour list".length) === "!monitor bonjour list") {
        this._retrieveBonjour(callback);
    }
};

monitor.prototype._retrieveArp = function (callback) {
    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM arp ORDER BY id ASC;", [],
        function (error, row) {
            if (error) {
                throw error;
            } else {
                if (row) {
                    callback(row.id + ' ' + row.created_date + ' ' + row.updated_date + ' ' + row.ip_address + ' ' + row.mac_address);
                }
            }
        });
};

monitor.prototype._retrieveIp = function (callback) {
    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM ip ORDER BY id ASC;", [],
        function (error, row) {
            if (error) {
                throw error;
            } else {
                if (row) {
                    callback(row.id + ' ' + row.created_date + ' ' + row.updated_date + ' ' + row.ip_address);
                }
            }
        });
};

monitor.prototype._retrieveBonjour = function (callback) {
    this.moduleManager.emit('database:monitor:retrieveOneByOne',
        "SELECT * FROM bonjour ORDER BY id ASC;", [],
        function (error, row) {
            if (error) {
                throw error;
            } else {
                if (row) {
                    callback(row.id + ' ' + row.created_date + ' ' + row.updated_date + ' ' + row.ip_address + ' ' + row.type + ' ' + row.name);
                }
            }
        });
};

module.exports = new monitor();
