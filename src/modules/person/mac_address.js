/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var _ = require('lodash');
var moment = require('moment');

var macvendor = require('macvendor');

function mac_address() {
    var communication = undefined;
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
    this.communication.on('synchronization:incoming:person:mac_address', this._onMacAddressIncomingSynchronization);
    this.communication.on('synchronization:outgoing:person:mac_address', this._onMacAddressOutgoingSynchronization);
};

mac_address.prototype.stop = function () {
    this.communication.removeListener('monitor:arp:create', this._onMacAddressOnline);
    this.communication.removeListener('monitor:arp:update', this._onMacAddressOnline);
    this.communication.removeListener('monitor:arp:delete', this._onMacAddressOffline);
    this.communication.removeListener('synchronization:incoming:person:mac_address', this._onMacAddressIncomingSynchronization);
    this.communication.removeListener('synchronization:outgoing:person:mac_address', this._onMacAddressIncomingSynchronization);
};

mac_address.prototype._onMacAddressOnline = function (address) {
    instance._findByAddress(address, function (error, row) {

        if (error) {
            console.error(error.stack);
        } else {
            var now = new Date();

            if (row !== undefined) {

                var was_present = row.is_present;

                row.updated_date = now;
                row.is_present = true;
                row.last_presence_date = now;
                row.is_synced = false;

                instance._updateByAddress(row.address, row, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        if (!was_present) {
                            instance.communication.emit('person:mac_address:online', row);
                        }

                        // lookup vendor
                        if (row.vendor === null) {
                            macvendor(row.address, function (error, vendor) {
                                if (error) {
                                    console.error(error.stack);
                                } else {
                                    if (vendor !== undefined && vendor !== null) {
                                        row.vendor = vendor;
                                        row.is_synced = false;
                                        row.updated_date = new Date();

                                        instance._updateByAddress(row.address, row, function (error) {
                                            if (error) {
                                                console.error(error.stack);
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            } else {

                row = {
                    address: address,
                    created_date: now,
                    updated_date: now,
                    last_presence_date: now,
                    is_present: true,
                    is_synced: false
                };

                instance._add(row, function (error) {
                    if (error) {
                        console.error(error.stack);
                    } else {
                        instance.communication.emit('person:mac_address:online', row);

                        // lookup vendor
                        if (row.vendor === null) {
                            macvendor(row.address, function (error, vendor) {
                                if (error) {
                                    console.error(error.stack);
                                } else {
                                    if (vendor !== undefined && vendor !== null) {
                                        row.vendor = vendor;
                                        row.is_synced = false;
                                        row.updated_date = new Date();

                                        instance._updateByAddress(row.address, row, function (error) {
                                            if (error) {
                                                console.error(error.stack);
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }
    });
};

mac_address.prototype._onMacAddressOffline = function (mac_address) {
    instance._findByAddress(mac_address, function (error, row) {
        if (error) {
            console.error(error.stack);
        } else {

            if (row !== undefined) {
                var now = new Date();

                row.updated_date = now;
                row.is_present = false;
                row.is_synced = false;

                instance._updateByAddress(row.address, row, function (error) {
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

mac_address.prototype._onMacAddressIncomingSynchronization = function (mac_address) {
    instance.communication.emit('database:person:retrieveAll', 'PRAGMA table_info(mac_address)', [], function (error, rows) {
        if (error) {
            console.error(error.stack);
        } else {

            // filter only required mac_address properties
            mac_address = _.pick(mac_address, _.pluck(rows, 'name'));
            mac_address.is_synced = true;

            instance._findByAddress(mac_address.address, function (error, row) {
                if (error) {
                    console.error(error);
                } else {
                    if (row !== undefined) {
                        if (moment(mac_address.updated_date).isAfter(row.updated_date)) {

                            if (mac_address.device_id === undefined) {
                                mac_address.device_id = null;
                            }

                            instance._updateByAddress(mac_address.address, mac_address, function (error) {
                                if (error) {
                                    console.error(error.stack);
                                }
                            });
                        }
                    } else {
                        instance._add(mac_address, function (error) {
                            if (error) {
                                console.error(error.stack);
                            }
                        });
                    }
                }
            });
        }
    });
};

mac_address.prototype._onMacAddressOutgoingSynchronization = function (callback) {
    instance.communication.emit('database:person:retrieveOneByOne',
        'SELECT * FROM mac_address WHERE is_synced = 0', [], function (error, row) {
            if (error) {
                console.error(error.stack);
            } else {
                if (row !== undefined) {
                    row.created_date = new Date(row.created_date.replace(' ', 'T'));
                    row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                    row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
                    row.is_present = row.is_present == 1;

                    callback(error, row, function (error) {
                        if (error) {
                            console.error(error)
                        } else {
                            row.is_synced = true;

                            instance._updateByAddress(row.address, row, function (error) {
                                if (error) {
                                    console.error(error.stack);
                                }
                            });
                        }
                    });
                }
            }
        });
};


mac_address.prototype._findByAddress = function (mac_address, callback) {
    this.communication.emit('database:person:retrieveOne',
        "SELECT * FROM mac_address WHERE address = ?;", [mac_address], function (error, row) {
            if (row !== undefined) {
                row.created_date = new Date(row.created_date.replace(' ', 'T'));
                row.updated_date = new Date(row.updated_date.replace(' ', 'T'));
                row.last_presence_date = new Date(row.last_presence_date.replace(' ', 'T'));
            }

            callback(error, row);
        });
};

mac_address.prototype._add = function (mac_address, callback) {
    if (mac_address.created_date !== undefined && mac_address.created_date !== null && mac_address.created_date instanceof Date) {
        mac_address.created_date = mac_address.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (mac_address.updated_date !== undefined && mac_address.updated_date !== null && mac_address.updated_date instanceof Date) {
        mac_address.updated_date = mac_address.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (mac_address.last_presence_date !== undefined && mac_address.last_presence_date !== null && mac_address.last_presence_date instanceof Date) {
        mac_address.last_presence_date = mac_address.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(mac_address);
    var values = _.values(mac_address);

    this.communication.emit('database:person:create',
        'INSERT INTO mac_address (' + keys + ') VALUES (' + values.map(function () {
            return '?';
        }) + ');',
        values,
        callback);
};

mac_address.prototype._updateByAddress = function (address, mac_address, callback) {
    if (mac_address.created_date !== undefined && mac_address.created_date !== null && mac_address.created_date instanceof Date) {
        mac_address.created_date = mac_address.created_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (mac_address.updated_date !== undefined && mac_address.updated_date !== null && mac_address.updated_date instanceof Date) {
        mac_address.updated_date = mac_address.updated_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    if (mac_address.last_presence_date !== undefined && mac_address.last_presence_date !== null && mac_address.last_presence_date instanceof Date) {
        mac_address.last_presence_date = mac_address.last_presence_date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    var keys = _.keys(mac_address);
    var values = _.values(mac_address);

    instance.communication.emit('database:person:update',
        'UPDATE mac_address SET ' + keys.map(function (key) {
            return key + ' = ?';
        }) + ' WHERE address = \'' + address + '\';',
        values, callback);
};

var instance = new mac_address();

module.exports = instance;
