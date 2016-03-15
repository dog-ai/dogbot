/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

global.SRC_PATH = __dirname + '/../src/'

var Promise = require('bluebird')

var chai = require('chai')
chai.use(require('chai-as-promised'));
chai.config.includeStack = true
global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert

var sinon = require('sinon')
require('sinon-as-promised')(Promise)
global.sinon = sinon
/*global.sinon.mockEvents = function (obj, event) {
 if (obj && obj instanceof require('events').EventEmitter) {
 var mock = sinon.mock()
 obj.on(event, function() {

 var callback, args;
 if (arguments) {
 callback = arguments[arguments.length - 1];
 args = [].slice.call(arguments,
 (arguments.length === 0 || arguments.length === 1) ? 0 : arguments.length - 2,
 arguments.length === 0 ? 0 : 1)[0];
 }

 mock(args)

 if (callback) {
 callback()
 }
 })
 return mock

 } else {
 return sinon.mock(obj)
 }
 }*/

var mockery = require('mockery')
mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false,
  useCleanCache: true
})
global.mockery = mockery

var _ = require('lodash')
global._ = _

var moment = require('moment')
global.moment = moment