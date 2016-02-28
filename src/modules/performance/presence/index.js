/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment');

function presence() {
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

    _.forEach(this.submodules, function (submodule) {
        require(submodule)(presence, instance);
    });

    this.start();
};

presence.prototype.unload = function () {
    this.stop();

    _.forEach(this.submodules, function (submodule) {
        delete require.cache[require.resolve(submodule)];
    });
};

presence.prototype.start = function () {
    this.communication.on('person:employee:nearby', this._onEmployeePresenceSample);
    this.communication.on('person:employee:faraway', this._onEmployeePresenceSample);
    this.communication.on('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);

    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSampleSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSampleSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:stats', this._onIncomingPresenceStatsSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence:stats', this._onOutgoingPresenceStatsSynchronization);



    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence'
    });


    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence:stats'
    });


    this.communication.on('performance:presence:stats:update:yesterday', this._updateAllEmployeeStatsWithYesterday);

    this.communication.emit('worker:job:enqueue', 'performance:presence:stats:update:yesterday', null, '5 minutes');
};

presence.prototype.stop = function () {
    this.communication.removeListener('person:employee:nearby', this._onEmployeePresenceSample);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresenceSample);
    this.communication.removeListener('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);

    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSampleSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSampleSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:stats', this._onIncomingPresenceStatsSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence:stats', this._onOutgoingPresenceStatsSynchronization);


    this.communication.removeListener('performance:presence:stats:generate:yesterday', this._generateAllEmployeeStatsForYesterday);

    this.communication.emit('worker:job:dequeue', 'performance:presence:stats:generate:yesterday');

};

presence.prototype._onEmployeePresenceSample = function (employee) {
    instance._findLatestPresenceByEmployeeId(employee.id).then(function (performance) {
        if (performance !== undefined) {
            if (performance.is_present == employee.is_present) {
                return;
            }

            if (moment(employee.last_presence_date).isSame(moment(performance.created_date))) {
                employee.last_presence_date = moment(employee.last_presence_date).add(1, 'second').toDate();
            }
        }

        return instance._createPresence({
            employee_id: employee.id,
            is_present: employee.is_present,
            created_date: employee.last_presence_date
        });
    }).catch(function (error) {
        logger.error(error.stack);
    });
};

var instance = new presence();

module.exports = instance;
