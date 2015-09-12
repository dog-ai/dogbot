/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');

function mac_address() {
    var communication = {};
}

mac_address.prototype.type = "PERSON";

mac_address.prototype.name = "mac_address";

mac_address.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

mac_address.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

mac_address.prototype.unload = function () {
    this.stop();
};

mac_address.prototype.start = function () {
    this.communication.on('monitor:arp:create', this._onMacAddressOnline);
    this.communication.on('monitor:arp:update', this._onMacAddressOnline);
    this.communication.on('monitor:arp:delete', this._onMacAddressOffline);
    this.communication.on('synchronization:person:mac_address', this._onMacAddressSynchronization);
};

mac_address.prototype.stop = function () {
    this.communication.removeListener('monitor:arp:create', this._onMacAddressOnline);
    this.communication.removeListener('monitor:arp:update', this._onMacAddressOnline);
    this.communication.removeListener('monitor:arp:delete', this._onMacAddressOffline);
    this.communication.removeListener('synchronization:person:mac_address', this._onMacAddressSynchronization);
};

mac_address.prototype._onMacAddressOnline = function (mac_address) {
    instance._findById(mac_address, function (error, row) {

        if (error) {
            console.error(error.stack);
        } else {

            if (row !== undefined) {
                var now = new Date();

                row.updated_date = now;
                row.is_present = true;
                row.last_presence_date = now;
                row.is_synced = false;

                instance._update(row.id, row.updated_date, row.is_present, row.last_presence_date, row.is_synced, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        instance.communication.emit('person:mac_address:online', row);
                    }
                });
            } else {
                var now = new Date();
                var is_present = true;
                var is_synced = false;

                instance._add(mac_address, now, now, is_present, now, is_synced, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        instance.communication.emit('person:mac_address:online', {
                            id: mac_address,
                            created_date: now,
                            updated_date: now,
                            is_present: is_present,
                            last_presence_date: now,
                            is_synced: is_synced
                        });
                    }
                });
            }
        }
    });
};

mac_address.prototype._onMacAddressOffline = function (mac_address) {
    instance._findById(mac_address, function (error, row) {
        if (error) {
            console.error(error.stack);
        } else {

            if (row !== undefined) {
                var now = new Date();

                row.updated_date = now;
                row.is_present = false;
                row.is_synced = false;

                instance._updateWithoutLastPresenceDate(row.id, row.updated_date, row.is_present, row.is_synced, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        instance.communication.emit('person:mac_address:offline', row);
                    }
                });
            }
        }

    });
};

mac_address.prototype._onMacAddressSynchronization = function (mac_address) {
    instance.communication.emit('database:person:retrieveAll', 'PRAGMA table_info(mac_address)', [], function (error, rows) {
        if (error) {
            console.error(error.stack);
        } else {

            mac_address = _.pick(mac_address, _.pluck(rows, 'name'));

            if (mac_address.created_date !== undefined && mac_address.created_date !== null) {
                mac_address.created_date = mac_address.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
            }

            if (mac_address.updated_date !== undefined && mac_address.updated_date !== null) {
                mac_address.updated_date = mac_address.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
            }
            if (mac_address.last_presence_date !== undefined && mac_address.last_presence_date !== null) {
                mac_address.last_presence_date = mac_address.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
            }

            mac_address.is_present = false;

            var keys = _.keys(mac_address);
            var values = _.values(mac_address);

            instance.communication.emit('database:person:create',
                'INSERT OR REPLACE INTO mac_address (' + keys + ') VALUES (' + values.map(function () {
                    return '?';
                }) + ');',
                values,
                function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {

                    }
                });
        }
    });
};

mac_address.prototype._findById = function (mac_address, callback) {
    this.communication.emit('database:person:retrieveOne',
        "SELECT * FROM mac_address WHERE id = ?;", [mac_address], callback);
};

mac_address.prototype._add = function (mac_address, created_date, updated_date, is_present, last_presence_date, is_synced, callback) {
    this.communication.emit('database:person:create',
        "INSERT OR REPLACE INTO mac_address (id, created_date, updated_date, is_present, last_presence_date, is_synced) VALUES (?, ?, ?, ?, ?, ?);",
        [
            mac_address,
            created_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            is_present,
            last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            is_synced
        ],
        callback);
};

mac_address.prototype._update = function (mac_address, updated_date, is_present, last_presence_date, is_synced, callback) {
    this.communication.emit('database:person:create',
        "UPDATE mac_address SET updated_date = ?, is_present = ?, last_presence_date = ?, is_synced = ? WHERE id = ?;",
        [
            updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            is_present,
            last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            is_synced,
            mac_address
        ],
        callback);
};

mac_address.prototype._updateWithoutLastPresenceDate = function (mac_address, updated_date, is_present, is_synced, callback) {
    this.communication.emit('database:person:create',
        "UPDATE mac_address SET updated_date = ?, is_present = ?, is_synced = ? WHERE id = ?;",
        [
            updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
            is_present,
            is_synced,
            mac_address
        ],
        callback);
};

var instance = new mac_address();

module.exports = instance;
