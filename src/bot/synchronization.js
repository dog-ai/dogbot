/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../utils/logger.js'),
    _ = require('lodash'),
    moment = require('moment-timezone'),
    Firebase = require('firebase'),
    firebase = new Firebase('https://dazzling-torch-7723.firebaseIO.com'),
    Promise = require('bluebird');

function synchronization() {
}

synchronization.prototype.initialize = function (token,
                                                 startOutgoingPeriodicSynchronizationFn,
                                                 onCompanyAppChangedCallback,
                                                 registerIncomingSynchronizationFn,
                                                 registerOutgoingPeriodicSynchronizationFn,
                                                 registerOutgoingQuickshotSynchronizationFn,
                                                 onOutgoingSynchronizeCallback) {

    return new Promise(function (resolve, reject) {

        return instance._authenticate(token)
            .then(function (dog) {

                instance.outgoingSynchronizeEvents = [];

                startOutgoingPeriodicSynchronizationFn(instance._periodicOutgoingSynchronization);
                instance.onCompanyAppChangedCallback = onCompanyAppChangedCallback;
                registerIncomingSynchronizationFn(synchronization.prototype._registerIncomingSynchronization);
                registerOutgoingPeriodicSynchronizationFn(synchronization.prototype._registerPeriodicOutgoingSynchronization);
                registerOutgoingQuickshotSynchronizationFn(synchronization.prototype._quickshotOutgoingSynchronization);
                instance.onOutgoingSynchronizeCallback = onOutgoingSynchronizeCallback;

                if (dog.company_id) {
                    instance.companyId = dog.company_id;
                    instance.companyRef = firebase.child('companies/' + dog.company_id);
                    instance.companyRef.child('/apps').on('child_changed', function (snapshot) {
                        var app = {};
                        app[snapshot.key()] = snapshot.val();

                        instance.onCompanyAppChangedCallback(app);
                    });
                    instance.companyRef.child('/apps').once('value',
                        function (snapshot) {
                            resolve([
                                instance.dogId,
                                snapshot.val()
                            ]);
                        },
                        function (error) {
                            reject(error);
                        });
                } else {
                    resolve([instance.dogId]);
                }
            })
    });
};

synchronization.prototype.terminate = function () {
    return new Promise(function (resolve, reject) {

        return instance._unauthenthicate()
            .then(function () {
                delete instance.companyId;
                delete instance.companyRef;
            })
            .then(resolve)
            .catch(reject)
    });
};

synchronization.prototype._authenticate = function (token) {
    return new Promise(function (resolve, reject) {

        firebase.authWithCustomToken(token, function (error, authData) {
            if (error) {
                reject(error);
            } else {
                instance.dogId = authData.uid;
                instance.dogRef = firebase.child('dogs/' + instance.dogId);
                instance.dogRef.once('value', function (snapshot) {
                    var dog = snapshot.val();
                    if (dog.timezone) {
                        moment.tz.setDefault(dog.timezone);
                    }

                    var now = moment().format();
                    if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
                        instance.dogRef.update({last_seen_date: now, updated_date: now});
                    }

                    resolve(dog);

                }, function (error) {
                    reject(error);
                });
            }
        });

    });
};

synchronization.prototype._unauthenthicate = function () {
    return new Promise(function (resolve) {
        var now = moment().format();

        if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
            instance.dogRef.update({last_seen_date: now, updated_date: now});
        }

        firebase.unauth();

        delete instance.dogId;
        delete instance.dogRef;

        resolve();
    });
};

synchronization.prototype._periodicOutgoingSynchronization = function (params, callback) {

    if (instance.companyRef) {
        _.forEach(instance.outgoingSynchronizeEvents, function (outgoing) {
            instance.onOutgoingSynchronizeCallback(outgoing.event, null, function (error, companyResourceObj, callback) {
                if (error) {
                    logger.error(error.stack);
                } else {
                    instance._sendCompanyResource(outgoing.companyResource, companyResourceObj, function (error) {
                        callback(error, companyResourceObj);
                    });
                }
            })
        });
    }

    var now = moment().format();

    if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
        instance.dogRef.update({last_seen_date: now, updated_date: now});
    }

    callback();
};

synchronization.prototype._quickshotOutgoingSynchronization = function (registerParams, outgoingParams, callback) {

    instance.onOutgoingSynchronizeCallback(registerParams.outgoingEvent, outgoingParams, function (error, companyResourceObj, callback) {
        if (error) {
            logger.error(error.stack);
        } else {
            instance._sendCompanyResource(registerParams.companyResource, companyResourceObj, function (error) {
                callback(error, companyResourceObj);
            });
        }
    });

    var now = moment().format();

    if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
        instance.dogRef.update({last_seen_date: now, updated_date: now});
    }

    if (callback) {
        callback();
    }
};

synchronization.prototype._registerIncomingSynchronization = function (params, callback) {
    if (instance.companyRef) {
        if (params.companyResource == 'employee_performances') {

            if (params.period) {
                var date = moment();
                var dateFormatPattern;
                switch (params.period) {
                    case 'daily':
                        date.subtract(1, 'day');
                        dateFormatPattern = 'YYYY/MM/DD';
                        break;
                    case 'monthly':
                        dateFormatPattern = 'YYYY/MM';
                        break;
                    case 'yearly':
                        dateFormatPattern = 'YYYY';
                        break;
                    case 'alltime':
                    default:
                        date = null;
                }

                firebase.child('company_employee_performances/' +
                        instance.companyId + '/' +
                        params.employeeId + '/' +
                        params.name + '/' +
                        (dateFormatPattern != null ? date.format(dateFormatPattern) + '/' : '') +
                        '/_stats')
                    .once('value', function (snapshot) {
                        var stats = snapshot.val();
                        if (stats) {

                            logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(stats));

                            params.onCompanyResourceChangedCallback(stats, date);
                        }
                    });

            } else {

                function retrieveLastPerformance(date) {
                    return new Promise(function (resolve, reject) {
                        firebase.child(
                                'company_employee_performances/' +
                                instance.companyId + '/' +
                                params.employeeId + '/' +
                                params.name + '/' +
                                date.format('YYYY/MM/DD'))
                            .orderByChild('created_date')
                            .limitToLast(1)
                            .once("value", function (snapshot) {
                                _.forEach(snapshot.val(), function (performance) {
                                    resolve(performance);
                                });
                            }, function (error) {
                                reject(error);
                            });
                    });
                }

                var now = moment();

                retrieveLastPerformance(now)
                    .then(function (performance) {
                        if (performance) {
                            if (performance.created_date !== undefined && performance.created_date !== null) {
                                performance.created_date = new Date(performance.created_date);
                            }

                            logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(performance));

                            params.onCompanyResourceChangedCallback(_.extend({
                                employee_id: params.employeeId,
                                is_synced: true
                            }, performance));
                        } else {
                            now.subtract(1, 'days');
                            return retrieveLastPerformance(now)
                                .then(function (performance) {
                                    if (performance) {
                                        if (performance.created_date !== undefined && performance.created_date !== null) {
                                            performance.created_date = new Date(performance.created_date);
                                        }

                                        logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(performance));

                                        params.onCompanyResourceChangedCallback(_.extend({
                                            employee_id: params.employeeId,
                                            is_synced: true
                                        }, performance));
                                    } else {
                                        now.subtract(1, 'days');
                                        return retrieveLastPerformance(now)
                                            .then(function (performance) {
                                                if (performance) {
                                                    if (performance.created_date !== undefined && performance.created_date !== null) {
                                                        performance.created_date = new Date(performance.created_date);
                                                    }

                                                    logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(performance));

                                                    params.onCompanyResourceChangedCallback(_.extend({
                                                        employee_id: params.employeeId,
                                                        is_synced: true
                                                    }, performance));
                                                }
                                            })
                                    }
                                })
                        }
                    })

            }
        } else {
            instance.companyRef.child('/' + params.companyResource).on('child_added',
                function (snapshot) {
                    var resourceId = snapshot.key();

                    function convert(resource) {
                        if (resource !== null) {
                            if (resource.created_date !== undefined && resource.created_date !== null) {
                                resource.created_date = new Date(resource.created_date);
                            }

                            if (resource.updated_date !== undefined && resource.updated_date !== null) {
                                resource.updated_date = new Date(resource.updated_date);
                            }

                            if (resource.last_presence_date !== undefined && resource.last_presence_date !== null) {
                                resource.last_presence_date = new Date(resource.last_presence_date);
                            }
                        }
                    }

                    firebase.child('company_' + params.companyResource + '/' + instance.companyId + '/' + resourceId).once('value', function (snapshot) {
                        var resource = snapshot.val();

                        convert(resource);

                        params.onCompanyResourceAddedCallback(_.extend({
                            id: resourceId,
                            is_synced: true
                        }, resource));

                        firebase.child('company_' + params.companyResource + '/' + instance.companyId + '/' + resourceId).on('value', function (snapshot) {
                            var resource = snapshot.val();

                            logger.debug('Incoming ' + params.companyResource + ': %s', JSON.stringify(resource));

                            convert(resource);

                            params.onCompanyResourceChangedCallback(_.extend({
                                id: resourceId,
                                is_synced: true
                            }, resource));
                        });
                    });

                });

            instance.companyRef.child('/' + params.companyResource).on('child_removed',
                function (snapshot) {
                    var resourceId = snapshot.key();

                    logger.debug('Incoming deleted ' + params.companyResource + ': %s', resourceId);

                    firebase.child('company_' + params.companyResource + '/' + instance.companyId + '/' + resourceId).off('value');
                    params.onCompanyResourceRemovedCallback({id: resourceId});
                });
        }
    }

    callback();
};

synchronization.prototype._registerPeriodicOutgoingSynchronization = function (params, callback) {
    instance.outgoingSynchronizeEvents.push({event: params.event, companyResource: params.companyResource});

    callback();
};

synchronization.prototype._sendCompanyResource = function (companyResource, companyResourceObj, callback) {
    if (!instance.companyRef) {
        callback();
    }

    if (companyResourceObj.is_to_be_deleted) {

        instance.companyRef.child(companyResource + '/' + companyResourceObj.id).remove(function (error) {
            if (error) {
                logger.error(error.stack);
            } else {
                var companyResourceRef = firebase.child('company_' + companyResource + '/' + instance.companyId + '/' + companyResourceObj.id);

                if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
                    companyResourceRef.set(null, function (error) {
                        callback(error, companyResourceObj);
                    });
                } else {
                    callback(null, companyResourceObj);
                }
            }
        });


    } else {
        var val = _.omit(companyResourceObj, ['id', 'is_synced']);
        val.created_date = moment(val.created_date).format();
        val.updated_date = moment(val.updated_date).format();
        if (val.last_presence_date !== undefined && val.last_presence_date !== null) {
            val.last_presence_date = moment(val.last_presence_date).format();
        }

        if (companyResourceObj.is_manual) {
            val = _.omit(val, ['name', 'type', 'os']);
        }

        var companyResourceRef;
        if (companyResource == 'employee_performances') {
            val = _.omit(val, ['name', 'employee_id']);

            var date;

            var dateFormatPattern = 'YYYY/MM/DD';
            var isStats = false;

            if (companyResourceObj.period) {
                switch (companyResourceObj.period) {
                    case 'monthly':
                        date = moment(companyResourceObj.started_date);

                        logger.debug('Outgoing employee performance monthly stats: %s', JSON.stringify(companyResourceObj));

                        dateFormatPattern = 'YYYY/MM';
                        break;
                    case 'yearly':
                        date = moment(companyResourceObj.started_date);

                        logger.debug('Outgoing employee performance yearly stats: %s', JSON.stringify(companyResourceObj));

                        dateFormatPattern = 'YYYY';
                        break;
                    case 'alltime':
                        logger.debug('Outgoing employee performance alltime stats: %s', JSON.stringify(companyResourceObj));

                        dateFormatPattern = null;
                        break;
                    default:
                        date = moment(companyResourceObj.started_date);

                        logger.debug('Outgoing employee performance daily stats: %s', JSON.stringify(companyResourceObj));
                }
                val = _.omit(val, ['period']);

                isStats = true;
            } else {
                date = moment(companyResourceObj.created_date);

                val = _.omit(val, ['updated_date']);

                logger.debug('Outgoing employee performances: %s', JSON.stringify(companyResourceObj));
            }

            companyResourceRef = firebase.child('company_' + companyResource + '/' +
                instance.companyId + '/' +
                companyResourceObj.employee_id + '/' +
                companyResourceObj.name + '/' +
                (dateFormatPattern != null ? date.format(dateFormatPattern) + '/' : '') +
                (isStats ? '_stats' : ''));

            if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
                if (isStats) {
                    companyResourceRef.set(val, callback);
                } else {
                    companyResourceRef.push(val, callback);
                }
            } else {
                callback(null);
            }

        } else {

            logger.debug('sending ' + companyResource + ': %s', JSON.stringify(companyResourceObj));

            val = _.omit(val, ['is_to_be_deleted', 'last_discovery_date']);

            if (companyResource == 'mac_addresses') {
                val = _.omit(val, ['is_present']);
            }

            val = _.extend(val, {company_id: instance.companyId});

            companyResourceRef = firebase.child('company_' + companyResource + '/' +
                instance.companyId + '/' +
                companyResourceObj.id);

            if (!process.env.DOGBOT_ENVIRONMENT || process.env.DOGBOT_ENVIRONMENT !== 'development') {
                companyResourceRef.update(val, function (error) {
                    if (error) {
                        callback(error);
                    } else {
                        instance.companyRef.child(companyResource + '/' + companyResourceRef.key()).set(true, function (error) {
                            callback(error);
                        });
                    }
                });
            } else {
                callback(null);
            }
        }
    }

};


synchronization.prototype.healthCheck = function () {
    return Promise.resolve();
};

var instance = new synchronization();

module.exports = instance;
