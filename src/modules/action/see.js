/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var s3 = require('s3');

function see() {
  var moduleManager = {};

  var client = {};

  var busy = false;
}

see.prototype.type = "PROCESS";

see.prototype.name = "see";

see.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

see.prototype.help = function() {
  var help = '';

  help += '*!see snapshot* - _Take a camera snapshot_';

  return help;
};

see.prototype.load = function (moduleManager, config) {
  this.moduleManager = moduleManager;

  if (process.platform !== 'linux') {
    throw new Error(process.platform + ' platform is not supported');
  }

  var accessKeyId = (config && config.auth && config.auth.access_key_id || undefined);
  if (!accessKeyId || accessKeyId.trim() === '') {
    throw new Error('invalid configuration: no authentication access key ID available');
  }

  var secretAccessKey = (config && config.auth && config.auth.secret_access_key || undefined);
  if (!secretAccessKey || accessKeyId.trim() === '') {
    throw new Error('invalid configuration: no authentication secret access key available');
  }

  this.client = s3.createClient({
    s3Options: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    }
  });
};

see.prototype.unload = function () {
};

see.prototype.process = function(message, callback) {
  var self = this;

  if (message === "!see snapshot" && !this.busy) {
    this.busy = true;

    this._snapshot(function(error) {
      var _self = self;

      if (error !== undefined && error !== null) {
        self.busy = false;
        throw new Error(error);
      } else {

        self._upload(function(error, url) {
          if (error !== undefined && error !== null) {
            _self.busy = false;
            throw new Error(error);
          } else {
            _self.busy = false;
            callback(url);
          }
        });

      }

    });
  }
};

see.prototype._snapshot = function(callback) {
  var width = 640;
  var height = 480;
  var rotation = 0;

  require('child_process')
    .exec('raspistill' +
      ' -w ' + width +
      ' -h ' + height +
      ' -rot ' + rotation +
      ' -o ' + __dirname + '/../../../var/tmp/snapshot.jpg',
      function(error, stdout, stderr) {
        if (error !== undefined && error !== null) {
          callback(error);
        } else {
          callback();
        }
      });
};

see.prototype._upload = function(callback) {
  var self = this;

  var key = 'snapshots/' +
    new Date().toISOString()
    .replace(/T/g, '')
    .replace(/-/g, '')
    .replace(/:/g, '')
    .replace(/\..+/, '') +
    '.jpg';

  var bucket = 'feedeobot';

  var uploader = this.client.uploadFile({
    localFile: __dirname + '/../../../tmp/snapshot.jpg',
    s3Params: {
      Bucket: bucket,
      Key: key,
      ACL: 'public-read'
    }
  });

  uploader.on('error', function(error) {
    callback(error);
  });

  uploader.on('progress', function() {});

  uploader.on('end', function() {
    callback(null, s3.getPublicUrlHttp(bucket, key));
  });
};

module.exports = new see();
