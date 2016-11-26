/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

global.SRC_PATH = __dirname + '/../src/'

const Promise = require('bluebird')

const chai = require('chai')
chai.should()

chai.use(require('chai-as-promised'))

chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert

const sinon = require('sinon')
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

const mockery = require('mockery')
mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false,
  useCleanCache: true
})
global.mockery = mockery

const _ = require('lodash')
global._ = _

const moment = require('moment')
global.moment = moment

const td = require('testdouble')
td.config({
  promiseConstructor: Promise
})

global.td = td
