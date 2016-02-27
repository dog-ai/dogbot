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
    this.communication.on('person:employee:nearby', this._onEmployeePresence);
    this.communication.on('person:employee:faraway', this._onEmployeePresence);

    this.communication.on('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.on('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);
    this.communication.emitAsync('synchronization:outgoing:periodic:register', {
        companyResource: 'employee_performances',
        event: 'synchronization:outgoing:performance:presence'
    });

    this.communication.on('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.on('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.on('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.on('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.on('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);
    this.communication.on('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);
    /*this.communication.emit('worker:job:enqueue', 'performance:presence:daily:stats', null, '01 00 00 * * *');
     this.communication.emit('worker:job:enqueue', 'performance:presence:monthly:stats', null, '02 00 00 * * *');
     this.communication.emit('worker:job:enqueue', 'performance:presence:alltime:stats', null, '03 00 00 * * *');*/
};

presence.prototype.stop = function () {
    this.communication.removeListener('person:employee:nearby', this._onEmployeePresence);
    this.communication.removeListener('person:employee:faraway', this._onEmployeePresence);
    this.communication.removeListener('synchronization:incoming:performance:presence', this._onIncomingPresenceSynchronization);
    this.communication.removeListener('synchronization:outgoing:performance:presence', this._onOutgoingPresenceSynchronization);

    this.communication.removeListener('performance:presence:daily:stats', this._generateDailyStats);
    this.communication.removeListener('performance:presence:monthly:stats', this._generateMonthlyStats);
    this.communication.removeListener('performance:presence:alltime:stats', this._generateAlltimeStats);
    this.communication.removeListener('synchronization:incoming:performance:presence:daily:stats', this._onIncomingEmployeeDailyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:monthly:stats', this._onIncomingEmployeeMonthlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:yearly:stats', this._onIncomingEmployeeYearlyStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:performance:presence:alltime:stats', this._onIncomingEmployeeAlltimeStatsSynchronization);
    this.communication.removeListener('synchronization:incoming:person:employee:create', this._onCreateEmployeeIncomingSynchronization);
    this.communication.emit('worker:job:dequeue', 'performance:presence:daily:stats');
    this.communication.emit('worker:job:dequeue', 'performance:presence:monthly:stats');
    this.communication.emit('worker:job:dequeue', 'performance:presence:alltime:stats');
};

presence.prototype._onEmployeePresence = function (employee) {
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
