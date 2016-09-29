/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const ffi = require('ffi')

const libsystemd = ffi.Library('libsystemd', {
  'sd_notify': [ 'int', [ 'int', 'string' ] ]
})

module.exports.sdNotifySync = libsystemd.sd_notify
module.exports.sdNotify = libsystemd.sd_notify.async
