/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var Presence, communication

describe('Presence', function () {
  before(function () {
  })

  beforeEach(function () {
    Presence = require(SRC_PATH + 'modules/performance/presence')
    communication = require(SRC_PATH + 'utils/communication')
  })

  afterEach(function () {
    delete require.cache[require.resolve(SRC_PATH + 'modules/performance/presence')]
    delete require.cache[require.resolve(SRC_PATH + 'utils/communication')];
  })

  after(function () {
  })

  describe('#load()', function () {
    it('should start listening to events', function () {

      Presence.load(communication)

      expect(communication._eventsCount).to.be.above(0)

    })
  })

  describe('#unload()', function () {
    it('should stop listening to events', function () {
      Presence.load(communication)
      Presence.unload()

      expect(communication._eventsCount).to.equal(0)
    })
  })

  /*describe('#emit()', function() {
   it('should invoke the callback', function (done) {
   var mock = sinon.mockEvents(communicati4on, 'foo');
   mock.once().withArgs({id: 1}).returns('test')

   communication.emitAsync('foo', {id: 1})
   .then(function() {
   mock.verify();
   done()
   })
   .catch(done)
   })
   })*/

  describe('^person:employee:nearby', function () {
    it('should create presence when employee is nearby', sinon.test(function (done) {
      var employee = {id: 1, is_present: true}

      var mock = this.mock(Presence)
      mock.expects('_findLatestPresenceByEmployeeId').once().withArgs(employee.id).resolves()
      mock.expects('_createPresence').once().withArgs(sinon.match({is_present: true})).resolves()

      Presence.load(communication)

      communication.emitAsync('person:employee:faraway', employee)
        .then(function () {
          mock.verify()

          done();
        })
        .catch(done)
    }))

    it('should not create duplicate presence when employee is already nearby', sinon.test(function (done) {
      var employee = {id: 1, is_present: true}
      var presence = {is_present: true}

      var mock = sinon.mock(Presence)
      mock.expects('_findLatestPresenceByEmployeeId').once().withArgs(employee.id).resolves(presence)
      mock.expects('_createPresence').never()

      Presence.load(communication)

      communication.emitAsync('person:employee:nearby', employee)
        .then(function () {
          mock.verify()

          done();
        })
        .catch(done)
    }))
  })

  describe('^person:employee:faraway', function () {
    it('should create presence when employee is faraway', sinon.test(function (done) {
      var employee = {id: 1, is_present: false}

      var mock = sinon.mock(Presence)
      mock.expects('_findLatestPresenceByEmployeeId').once().withArgs(employee.id).resolves()
      mock.expects('_createPresence').once().withArgs(sinon.match({is_present: false})).resolves()

      Presence.load(communication)

      communication.emitAsync('person:employee:faraway', employee)
        .then(function () {
          mock.verify()

          done();
        })
        .catch(done)
    }))

    it('should not create duplicate presence when employee is already faraway', sinon.test(function (done) {
      var employee = {id: 1, is_present: false}
      var presence = {is_present: false}

      var mock = sinon.mock(Presence)
      mock.expects('_findLatestPresenceByEmployeeId').once().withArgs(employee.id).resolves(presence)
      mock.expects('_createPresence').never()

      Presence.load(communication)

      communication.emitAsync('person:employee:faraway', employee)
        .then(function () {
          mock.verify()
          mock.restore()

          done();
        })
        .catch(done)
    }))
  })

  describe('^performance:presence:stats:update:yesterday', function () {
    it('should compute employee stats for day', function (done) {
      var date = moment('2016-03-08T00:00:00+01:00:00')

      var presences = [
        {created_date: new Date('2016-03-08T04:00:00'), is_present: true},
        {created_date: new Date('2016-03-08T08:00:00'), is_present: false},
        {created_date: new Date('2016-03-08T20:00:00'), is_present: true},
        {created_date: new Date('2016-03-08T22:00:00'), is_present: false}
      ]

      Presence.load(communication)

      Presence._computeEmployeeDailyStats(null, date, presences)
        .then(function (stats) {

          expect(stats).to.not.be.undefined.and.not.be.null
          expect(stats).to.have.all.keys([
            'created_date',
            'updated_date',
            'period',
            'started_date',
            'ended_date',
            'start_time',
            'end_time',
            'total_duration'
          ])
          expect(stats.created_date).to.be.ok
          expect(stats.updated_date).to.be.ok
          expect(stats.period).to.be.equal('daily')
          expect(stats.started_date).to.be.equal('2016-03-08T00:00:00+01:00')
          expect(stats.ended_date).to.be.equal('2016-03-08T23:59:59+01:00')
          expect(stats.start_time).to.be.equal(18000)
          expect(stats.end_time).to.be.equal(82800)
          expect(stats.total_duration).to.be.equal(21600)

          done()
        })
        .catch(done)
    })

    it('should compute employee stats for month', function (done) {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'daily',
        started_date: '2016-03-09T00:00:00+01:00',
        ended_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var monthStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'monthly',
        started_date: '2016-03-08T00:00:00+01:00',
        ended_date: '2016-03-08T23:59:59+01:00',
        total_days: 31,
        present_days: 1,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        minimum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        maximum_total_duration: 21600,
        start_time_by_day: {'1457391600': 18000},
        end_time_by_day: {'1457391600': 82800},
        total_duration_by_day: {'1457391600': 21600}
      }

      var period = 'monthly'

      Presence.load(communication)

      Presence._computeEmployeePeriodStats(null, dayStats, monthStats, date, period)
        .then(function (stats) {

          expect(stats).to.not.be.undefined.and.not.be.null
          expect(stats).to.have.all.keys([
            'created_date',
            'updated_date',
            'period',
            'started_date',
            'ended_date',
            'total_days',
            'present_days',
            'average_start_time',
            'average_end_time',
            'average_total_duration',
            'maximum_start_time',
            'maximum_end_time',
            'maximum_total_duration',
            'minimum_start_time',
            'minimum_end_time',
            'minimum_total_duration',
            'start_time_by_day',
            'end_time_by_day',
            'total_duration_by_day'
          ])
          expect(stats.created_date).to.be.ok
          expect(stats.updated_date).to.be.ok
          expect(stats.period).to.be.equal('monthly')
          expect(stats.started_date).to.be.equal('2016-03-08T00:00:00+01:00')
          expect(stats.ended_date).to.be.equal('2016-03-09T23:59:59+01:00')
          expect(stats.total_days).to.be.equal(31)
          expect(stats.present_days).to.be.equal(2)
          expect(stats.average_start_time).to.be.equal(18000)
          expect(stats.average_end_time).to.be.equal(82800)
          expect(stats.average_total_duration).to.be.equal(21600)
          expect(stats.maximum_start_time).to.be.equal(18000)
          expect(stats.maximum_end_time).to.be.equal(82800)
          expect(stats.maximum_total_duration).to.be.equal(21600)
          expect(stats.minimum_start_time).to.be.equal(18000)
          expect(stats.minimum_end_time).to.be.equal(82800)
          expect(stats.minimum_total_duration).to.be.equal(21600)
          expect(stats.start_time_by_day).to.have.all.keys({'1457391600': 18000, '1457478000': 18000})
          expect(stats.end_time_by_day).to.have.all.keys({'1457391600': 82800, '1457478000': 82800})
          expect(stats.total_duration_by_day).to.have.all.keys({'1457391600': 21600, '1457478000': 21600})

          done()
        })
        .catch(done)
    })

    it('should compute employee stats for year', function (done) {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'daily',
        started_date: '2016-03-09T00:00:00+01:00',
        ended_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var yearStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'monthly',
        started_date: '2016-03-08T00:00:00+01:00',
        ended_date: '2016-03-08T23:59:59+01:00',
        total_days: 365,
        present_days: 1,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        minimum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        maximum_total_duration: 21600
      }

      var period = 'yearly'

      Presence.load(communication)

      Presence._computeEmployeePeriodStats(null, dayStats, yearStats, date, period)
        .then(function (stats) {

          expect(stats).to.not.be.undefined.and.not.be.null
          expect(stats).to.have.all.keys([
            'created_date',
            'updated_date',
            'period',
            'started_date',
            'ended_date',
            'total_days',
            'present_days',
            'average_start_time',
            'average_end_time',
            'average_total_duration',
            'maximum_start_time',
            'maximum_end_time',
            'maximum_total_duration',
            'minimum_start_time',
            'minimum_end_time',
            'minimum_total_duration',
          ])
          expect(stats.created_date).to.be.ok
          expect(stats.updated_date).to.be.ok
          expect(stats.period).to.be.equal('yearly')
          expect(stats.started_date).to.be.equal('2016-03-08T00:00:00+01:00')
          expect(stats.ended_date).to.be.equal('2016-03-09T23:59:59+01:00')
          expect(stats.total_days).to.be.equal(365)
          expect(stats.present_days).to.be.equal(2)
          expect(stats.average_start_time).to.be.equal(18000)
          expect(stats.average_end_time).to.be.equal(82800)
          expect(stats.average_total_duration).to.be.equal(21600)
          expect(stats.maximum_start_time).to.be.equal(18000)
          expect(stats.maximum_end_time).to.be.equal(82800)
          expect(stats.maximum_total_duration).to.be.equal(21600)
          expect(stats.minimum_start_time).to.be.equal(18000)
          expect(stats.minimum_end_time).to.be.equal(82800)
          expect(stats.minimum_total_duration).to.be.equal(21600)

          done()
        })
        .catch(done)
    })

    it('should compute employee stats for all-time', function (done) {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'daily',
        started_date: '2016-03-09T00:00:00+01:00',
        ended_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var allTimeStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'monthly',
        started_date: '2016-03-08T00:00:00+01:00',
        ended_date: '2016-03-08T23:59:59+01:00',
        total_days: 365,
        present_days: 1,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        minimum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        maximum_total_duration: 21600,
        previous_average_start_time: 0,
        previous_average_end_time: 0,
        previous_average_total_duration: 0
      }

      var period = 'alltime'

      Presence.load(communication)

      Presence._computeEmployeePeriodStats(null, dayStats, allTimeStats, date, period)
        .then(function (stats) {

          expect(stats).to.not.be.undefined.and.not.be.null
          expect(stats).to.have.all.keys([
            'created_date',
            'updated_date',
            'period',
            'started_date',
            'ended_date',
            'total_days',
            'present_days',
            'average_start_time',
            'average_end_time',
            'average_total_duration',
            'maximum_start_time',
            'maximum_end_time',
            'maximum_total_duration',
            'minimum_start_time',
            'minimum_end_time',
            'minimum_total_duration',
            'previous_average_start_time',
            'previous_average_end_time',
            'previous_average_total_duration'
          ])
          expect(stats.created_date).to.be.ok
          expect(stats.updated_date).to.be.ok
          expect(stats.period).to.be.equal('alltime')
          expect(stats.started_date).to.be.equal('2016-03-08T00:00:00+01:00')
          expect(stats.ended_date).to.be.equal('2016-03-09T23:59:59+01:00')
          expect(stats.total_days).to.be.equal(365)
          expect(stats.present_days).to.be.equal(2)
          expect(stats.average_start_time).to.be.equal(18000)
          expect(stats.average_end_time).to.be.equal(82800)
          expect(stats.average_total_duration).to.be.equal(21600)
          expect(stats.maximum_start_time).to.be.equal(18000)
          expect(stats.maximum_end_time).to.be.equal(82800)
          expect(stats.maximum_total_duration).to.be.equal(21600)
          expect(stats.minimum_start_time).to.be.equal(18000)
          expect(stats.minimum_end_time).to.be.equal(82800)
          expect(stats.minimum_total_duration).to.be.equal(21600)
          expect(stats.previous_average_start_time).to.be.equal(18000)
          expect(stats.previous_average_end_time).to.be.equal(82800)
          expect(stats.previous_average_total_duration).to.be.equal(21600)

          done()
        })
        .catch(done)
    })
  })
})
