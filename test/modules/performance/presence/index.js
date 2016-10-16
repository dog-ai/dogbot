/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

'use strict'

var Presence, communication

describe('Presence', function () {
  before(function () {
    // communication = require(SRC_PATH + 'utils/communication')
  })

  beforeEach(function () {
    // Presence = require(SRC_PATH + 'modules/performance/presence')
  })

  afterEach(function () {
    // delete require.cache[require.resolve(SRC_PATH + 'modules/performance/presence')]
  })

  after(function () {
    // delete require.cache[require.resolve(SRC_PATH + 'utils/communication')];
  })

  /*
  describe('#load()', function () {
    it('should start listening to events', function () {

      Presence.load(communication)

      expect(communication._eventsCount).to.be.above(0)

    })
  })
   */

  /*
  describe('#unload()', function () {
    it('should stop listening to events', function () {
      Presence.load(communication)
      Presence.unload()

      expect(communication._eventsCount).to.equal(0)
    })
  })
   */

  /*
   describe('#emit()', function() {
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
   })
   */

  /*
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

      var mock = this.mock(Presence)
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

      var mock = this.mock(Presence)
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

      var mock = this.mock(Presence)
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

   */

  /*
  describe('^performance:presence:stats:update:yesterday', function () {
    it('should compute employee stats for day', function () {
      var date = moment('2016-03-08T00:00:00+01:00:00')

      var presences = [
        {created_date: new Date('2016-03-08T04:00:00'), is_present: true},
        {created_date: new Date('2016-03-08T08:00:00'), is_present: false},
        {created_date: new Date('2016-03-08T20:00:00'), is_present: true},
        {created_date: new Date('2016-03-08T22:00:00'), is_present: false}
      ]

      Presence.load(communication)

      var promise = Presence._computeEmployeeDailyStats(null, date, presences);

      return expect(promise).to.eventually.contain({
        total_duration: 21600,
        start_time: 18000,
        end_time: 82800,
        period: 'day',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-08T23:59:59+01:00'
      }).and.have.all.keys(['created_date', 'updated_date']);
    })

    it('should not compute employee stats for day when no samples available', function () {
      var date = moment('2016-03-08T00:00:00+01:00:00')

      var presences = []

      Presence.load(communication)

      var promise = Presence._computeEmployeeDailyStats(null, date, presences);

      return expect(promise).to.eventually.be.undefined;
    })

    it('should compute employee stats for month', function () {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'day',
        period_start_date: '2016-03-09T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var monthStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'month',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-08T23:59:59+01:00',
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

      var period = 'month'

      Presence.load(communication)

      var promise = Presence._computeEmployeePeriodStats(null, dayStats, monthStats, date, period)

      return expect(promise).to.eventually.contain({
        period: 'month',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        total_days: 31,
        present_days: 2,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        maximum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        minimum_total_duration: 21600,
      }).and.have.all.keys(['created_date', 'updated_date'])
    })

    it('should not compute employee stats for month when no day stats available', function () {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = undefined

      var monthStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'month',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-08T23:59:59+01:00',
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

      var period = 'month'

      Presence.load(communication)

      var promise = Presence._computeEmployeePeriodStats(null, dayStats, monthStats, date, period)

      return expect(promise).to.eventually.become(monthStats)
    })

    it('should compute employee stats for year', function () {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'day',
        period_start_date: '2016-03-09T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var yearStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'month',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-08T23:59:59+01:00',
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

      var period = 'year'

      Presence.load(communication)

      var promise = Presence._computeEmployeePeriodStats(null, dayStats, yearStats, date, period)

      return expect(promise).to.eventually.contain({
        period: 'year',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        total_days: 365,
        present_days: 2,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        maximum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        minimum_total_duration: 21600,
      }).and.have.all.keys(['created_date', 'updated_date'])
    })

    it('should compute employee stats for all-time', function () {
      var date = moment('2016-03-09T00:00:00+01:00:00')

      var dayStats = {
        created_date: '2016-03-10T03:00:00+01:00',
        updated_date: '2016-03-10T03:00:00+01:00',
        period: 'day',
        period_start_date: '2016-03-09T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        start_time: 18000,
        end_time: 82800,
        total_duration: 21600
      }

      var allTimeStats = {
        created_date: '2016-03-09T03:00:00+01:00',
        updated_date: '2016-03-09T03:00:00+01:00',
        period: 'month',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-08T23:59:59+01:00',
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

      var period = 'all-time'

      Presence.load(communication)

      var promise = Presence._computeEmployeePeriodStats(null, dayStats, allTimeStats, date, period)

      return expect(promise).to.eventually.contain({
        period: 'all-time',
        period_start_date: '2016-03-08T00:00:00+01:00',
        period_end_date: '2016-03-09T23:59:59+01:00',
        total_days: 365,
        present_days: 2,
        average_start_time: 18000,
        average_end_time: 82800,
        average_total_duration: 21600,
        maximum_start_time: 18000,
        maximum_end_time: 82800,
        maximum_total_duration: 21600,
        minimum_start_time: 18000,
        minimum_end_time: 82800,
        minimum_total_duration: 21600,
        previous_average_start_time: 18000,
        previous_average_end_time: 82800,
        previous_average_total_duration: 21600
      }).and.have.all.keys(['created_date', 'updated_date'])
    })
  })
   */
})
