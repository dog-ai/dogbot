/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment');

function _loadSubmodules(submodules) {
    _.forEach(submodules, function (submoduleName) {
        var submodule = require(submoduleName);
        for (var fnName in submodule.prototype) {
            if (!_.includes(['constructor', 'start', 'stop'], fnName)) {
                presence.prototype[fnName] = submodule.prototype[fnName];
            }
        }
    });
}

function _unloadSubmodules(submodules) {
    _.forEach(submodules, function (submoduleName) {
        delete require.cache[require.resolve(submoduleName)];
    });
}

function _startSubmodules(submodules) {
    var self = this;

    _.forEach(submodules, function (submoduleName) {
        var submodule = require(submoduleName);
        if (submodule.prototype && submodule.prototype['start']) {
            submodule.prototype.start.bind(self)();
        }
    });
}

function _stopSubmodules(submodules) {
    var self = this;

    _.forEach(submodules, function (submoduleName) {
        var submodule = require(submoduleName);
        if (submodule.prototype && submodule.prototype['stop']) {
            submodule.prototype.stop.bind(self)();
        }
    });
}

function presence() {
    _loadSubmodules(this.submodules);
}

presence.prototype.type = "PERFORMANCE";

presence.prototype.name = "presence";

presence.prototype.submodules = [
    './database',
    './synchronization',
    './stats'
];

presence.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.toUpperCase() + " " +
        this.type.toLowerCase() + " module_";
};

presence.prototype.load = function (communication) {
    this.communication = communication;

    this.start();
};

presence.prototype.unload = function () {
    this.stop();

    _unloadSubmodules(this.submodules);
};

presence.prototype.start = function () {
    this.communication.on('person:employee:nearby', this._onEmployeePresenceSample.bind(this));
    this.communication.on('person:employee:faraway', this._onEmployeePresenceSample.bind(this));

    _startSubmodules.bind(this)(this.submodules);
};

presence.prototype.stop = function () {
    _stopSubmodules.bind(this)(this.submodules);

    this.communication.removeListener('person:employee:nearby', this._onEmployeePresenceSample.bind(this));
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresenceSample.bind(this));
};

presence.prototype._onEmployeePresenceSample = function (employee) {
    var self = this;

    this._findLatestPresenceByEmployeeId(employee.id).then(function (performance) {
        if (performance !== undefined) {
            if (performance.is_present == employee.is_present) {
                return;
            }

            if (moment(employee.last_presence_date).isSame(moment(performance.created_date))) {
                employee.last_presence_date = moment(employee.last_presence_date).add(1, 'second').toDate();
            }
        }

        return self._createPresence({
            employee_id: employee.id,
            is_present: employee.is_present,
            created_date: employee.last_presence_date
        });
    }).catch(function (error) {
        logger.error(error.stack);
    });
};

module.exports = new presence();
