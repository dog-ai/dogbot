/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var _ = require('lodash'),
  Promise = require('bluebird');

var redis = require("redis");

var ENVIRONMENT = process.env.DOGBOT_ENVIRONMENT || 'development';

var REDIS_UNIX_SOCKET = ENVIRONMENT === 'development' ? __dirname + '/../../../var/run/redis.sock' : '/var/run/redis.sock';

function nosql() {
}

nosql.prototype.type = 'nosql';

nosql.prototype._open = function (prefix) {
  var self = this;

  return new Promise(function (resolve, reject) {

    if (!self.client) {
      self.client = redis.createClient(REDIS_UNIX_SOCKET, {
        prefix: prefix + ':',
        max_attempts: 1
      });

      self.client.once("ready", function () {
        self.client.keys(prefix + ':*', function (error, keys) {
          if (error) {
            reject(error);
          } else {
            _.forEach(keys, function (key) {
              self.client.del(key.substring((prefix + ':').length));
            });

            resolve({
              redis: {
                socket: REDIS_UNIX_SOCKET,
                options: {
                  max_attempts: 1
                }
              }
            });
          }
        });
      });

      // we shouldn't listen like this, unfortunately node-redis kinda sucks
      self.client.on("error", function (error) {
        reject(error);
      });
    }
  });
};

nosql.prototype._close = function () {
  var self = this;

  return new Promise(function (resolve, reject) {
    if (!self.client) {
      self.client.end(true);

      delete self.client;

      self.client.once("end", function () {
        resolve();
      });

      self.client.once("error", function (error) {
        reject(error);
      });

    } else {
      resolve();
    }
  });
};

nosql.prototype._set = function (prefix, key, val, callback) {
  if (val instanceof Array || val instanceof Object) {
    val = JSON.stringify(val);
  }

  this.client.set(prefix + ':' + key, val, callback);
};

nosql.prototype._get = function (prefix, key, callback) {
  this.client.get(prefix + ':' + key, function (error, reply) {
    if (error) {
      callback(error);
    } else {
      if (reply && (reply.charAt(0) === '{' || reply.charAt(0) === '[')) {
        reply = JSON.parse(reply);
      }

      callback(null, reply);
    }
  });
};

nosql.prototype._hset = function (prefix, key, field, val, callback) {
  var _val = _.clone(val);

  if (_val instanceof Array || _val instanceof Object) {
    _val = JSON.stringify(_val);
  }

  this.client.hset(prefix + ':' + key, field, _val, callback);
};

nosql.prototype._hget = function (prefix, key, field, callback) {
  this.client.hget(prefix + ':' + key, field, function (error, reply) {
    if (error) {
      callback(error);
    } else {
      if (reply && (reply.charAt(0) === '{' || reply.charAt(0) === '[')) {
        reply = JSON.parse(reply);
      }

      callback(null, reply);
    }
  });
};

nosql.prototype._hmset = function (prefix, key, val, callback) {
  var _val = _.clone(val);

  /*_val['start_time_by_day'] = _val['start_time_by_day'] && JSON.stringify(_val['start_time_by_day']);
   _val['end_time_by_day'] = _val['end_time_by_day'] && JSON.stringify(_val['end_time_by_day']);
   _val['total_duration_by_day'] = _val['total_duration_by_day'] && JSON.stringify(_val['total_duration_by_day']);*/

  this.client.hmset(prefix + ':' + key, _val, callback);
};

nosql.prototype._hgetall = function (prefix, key, callback) {
  this.client.hgetall(prefix + ':' + key, function (error, reply) {
    if (error) {
      callback(error);
    } else {

      /*var _reply = _.map(reply, function (value) {
       return JSON.parse(value);
       });*/

      /*if (reply) {
       reply['maximum_start_time'] = reply['maximum_start_time'] && parseInt(reply['maximum_start_time']);
       reply['minimum_start_time'] = reply['minimum_start_time'] && parseInt(reply['minimum_start_time']);
       reply['average_start_time'] = reply['average_start_time'] && parseInt(reply['average_start_time']);
       reply['start_time_by_day'] = reply['start_time_by_day'] && JSON.parse(reply['start_time_by_day']);

       reply['maximum_end_time'] = reply['maximum_end_time'] && parseInt(reply['maximum_end_time']);
       reply['minimum_end_time'] = reply['minimum_end_time'] && parseInt(reply['minimum_end_time']);
       reply['average_end_time'] = reply['average_end_time'] && parseFloat(reply['average_end_time']);
       reply['end_time_by_day'] = reply['end_time_by_day'] && JSON.parse(reply['end_time_by_day']);

       reply['maximum_total_duration'] = reply['maximum_total_duration'] && parseInt(reply['maximum_total_duration']);
       reply['minimum_total_duration'] = reply['minimum_total_duration'] && parseInt(reply['minimum_total_duration']);
       reply['average_total_duration'] = reply['average_total_duration'] && parseFloat(reply['average_total_duration']);
       reply['total_duration_by_day'] = reply['total_duration_by_day'] && JSON.parse(reply['total_duration_by_day']);

       reply['present_days'] = reply['present_days'] && parseInt(reply['present_days']);
       reply['total_days'] = reply['total_days'] && parseInt(reply['total_days']);
       }*/

      callback(null, reply);
    }
  });
};

module.exports = nosql;
