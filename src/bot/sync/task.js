/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var logger = require('../../utils/logger.js'),
  Promise = require('bluebird');

var FirebaseQueue = require('firebase-queue');

function Task() {
}

Task.prototype.initialize = function (ref, companyId, onIncomingTaskCallback) {
  var refs = {
    tasksRef: ref.child('companies/' + companyId + '/tasks'),
    specsRef: ref.child('queue/specs')
  };

  var options = {
    'specId': 'default_spec',
    'numWorkers': 1,
    'suppressStack': true
  };

  this._queue = new FirebaseQueue(refs, options, function (task, progress, resolve, reject) {
    logger.debug('Incoming task: ' + JSON.stringify(task));

    if (task && task.event) {
      onIncomingTaskCallback(task.event, task.data, progress, resolve, reject);
    }
  });
};

Task.prototype.terminate = function () {
  var _this = this;

  return new Promise(function (resolve, reject) {
    _this._queue.shutdown()
      .then(resolve)
      .catch(reject);
  });
};

module.exports = new Task();