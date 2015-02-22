/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
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
}

see.prototype.help = function() {
  var help = '';

  help += '*!see snapshot* - _Take a camera snapshot_'

  return help;
}

see.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;

  if (process.platform !== 'linux') {
    throw new Error(process.platform + ' platform is not supported');
  }
}

see.prototype.unload = function() {}

see.prototype.process = function(message, callback) {
  var self = this;

  if (message === "!see snapshot" && !this.busy) {
    this.busy = true;

    this._snapshot(function(error) {
      var _self = self;

      if (error !== undefined) {
        throw new Error(error);

        self.busy = false;
      } else {

        self._upload(function(error, url) {
          if (error !== null) {
            throw new Error(error);
          } else {
            callback(url);
          }

          _self.busy = false;
        });

      }

    });
  }
}

see.prototype._snapshot = function(callback) {
  var width = 640;
  var height = 480;
  var rotation = 270;

  require('child_process')
    .exec('raspistill' +
      ' -w ' + width +
      ' -h ' + height +
      ' -rot ' + rotation +
      ' -o ' + __dirname + '/../../../tmp/snapshot.jpg',
      function(error, stdout, stderr) {
        if (error !== null) {
          callback(error);
        } else {
          callback();
        }
      });
}

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
}

var instance = new see();

instance.client = s3.createClient({
  s3Options: {
    accessKeyId: "AKIAII4PCLQ4QBLWZJEQ",
    secretAccessKey: "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",
  }
});

module.exports = instance;
