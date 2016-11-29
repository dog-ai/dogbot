/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Promise = require('bluebird')

const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.config.includeStack = true

const td = require('testdouble')
td.config({
  promiseConstructor: Promise,
  ignoreWarnings: true
})

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert
global.td = td
