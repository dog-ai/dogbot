/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var Logger = require('../../utils/Logger.js');

var gcal = require('google-calendar');
var moment = require('moment');

function calendar() {
  var moduleManager = {};
}

calendar.prototype.type = "PROCESS";

calendar.prototype.name = "calendar";

calendar.prototype.info = function() {
  return "*" + this.name + "* - " +
    "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
    this.type.toLowerCase() + " module_";
};

calendar.prototype.help = function() {
  var help = '';

  help += '*!calendar* - _Show calendar events for today_';

  return help;
};

calendar.prototype.load = function(moduleManager) {
  this.moduleManager = moduleManager;
};

calendar.prototype.unload = function () {
};

calendar.prototype.process = function(message, callback) {
  var self = this;

  if (message === "!calendar") {

    var google = this.moduleManager.findLoadedModuleByName('google');
    google.getAccounts(function(error, accounts) {
      if (error !== undefined && error !== null) {
        Logger.error(error);
      } else {
        accounts.forEach(function(account) {

          self.retrieveEventListForToday(account.user_id, account.access_token, function(error, eventList) {
            if (eventList.items.length === 0) {
              callback('No calendar events scheduled for today.');
              return;
            }

            var response = '';
            eventList.items.forEach(function(event) {
              Logger.info(event);
              response += event.summary + '\n';

              if (event.location !== undefined) {
                response += event.location + '\n';
              }

              response += moment(event.start.dateTime).format('HH:mm') + ' (duration ' + moment.duration(moment(event.end.dateTime).diff(moment(event.start.dateTime))).asMinutes() + ' minutes)\n';

              if (event.attendees !== undefined) {
                event.attendees.forEach(function(attendee) {
                  response += attendee.displayName + ', ';

                });
                response = response.substring(0, response.length - 2);
                response += '\n\n';
              }

              callback(response);
            });
          });

        });
      }
    });
  }
};

calendar.prototype.retrieveEventListForToday = function(userId, accessToken, callback, retry) {
  var self = this;

  var today = moment().format('YYYY-MM-DD') + 'T';
  var currentTime = moment().format('HH:mm:ss') + '.000Z';

  var google = this.moduleManager.findLoadedModuleByName('google');
  var google_calendar = new gcal.GoogleCalendar(accessToken);

  google_calendar.calendarList.list(
    function(error, calendarList) {
      if (error !== undefined && error !== null) {
        if (error.code === 401 && retry === undefined) {
          google.refreshAuth(userId, function() {
            self.retrieveEventListForToday(userId, accessToken, callback, true);
          });
        }
      } else {
        calendarList.items.forEach(function(calendar) {

          if (calendar.id.indexOf('#') == -1) {
            google_calendar.events.list(calendar.id, {
                timeMin: today + currentTime,
                timeMax: today + '23:59:59.000Z',
                singleEvents: true
              },
              function(error, eventList) {
                callback(error, eventList);
              });
          }

        });

      }
    });
};

module.exports = new calendar();
