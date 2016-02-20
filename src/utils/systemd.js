var ffi = require('ffi');

var libsystemd = ffi.Library('libsystemd', {
    'sd_notify': ['int', ['int', 'string']]
});

module.exports.sdNotifySync = libsystemd.sd_notify;
module.exports.sdNotify = libsystemd.sd_notify.async;