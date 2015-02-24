/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var http = require('http');

var options = {
  host: 'api.openweathermap.org',
  port: 80,
  path: '/data/2.5/weather?q=stockholm,sweden',
  method: 'GET'
};

function weather() {
  var moduleManager = {};
}

weather.prototype.type = "PROCESS";

weather.prototype.name = "weather";

weather.prototype.info = function() {
  return "*" + this.name +"* - _Feedeo Weather Service processing module_";
}

weather.prototype.help = function() {
  var help = '';

  help += '*!weather* - _Retrieve the weather for Stockholm_'

  return help;
}

weather.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

weather.prototype.unload = function() {
}

/*
PAYLOAD
{  
   "coord":{  
      "lon":18.06,
      "lat":59.33
   },
   "sys":{  
      "message":0.0198,
      "country":"SE",
      "sunrise":1424757483,
      "sunset":1424793825
   },
   "weather":[  
      {  
         "id":801,
         "main":"Clouds",
         "description":"few clouds",
         "icon":"02n"
      }
   ],
   "base":"cmc stations",
   "main":{  
      "temp":274.29,
      "temp_min":274.29,
      "temp_max":274.29,
      "pressure":1010.33,
      "sea_level":1013.27,
      "grnd_level":1010.33,
      "humidity":90
   },
   "wind":{  
      "speed":3.4,
      "deg":185.501
   },
   "clouds":{  
      "all":24
   },
   "dt":1424794098,
   "id":2673730,
   "name":"Stockholm",
   "cod":200
}
*/
weather.prototype.process = function(message, callback) {

  if (message === "!weather") {
    http.request(options, function(response) {
        var str = '';
        response.on('data', function(chunk) {
          str += chunk;
        });
        response.on('end', function() {
          var page = JSON.parse(str);

          var response = page.name + ' http://openweathermap.org/img/w/' + page.weather[0].icon +  '.png' + ' ' + Math.round(page.main.temp - 273.15) + " Celsius\n" +
          page.weather[0].description;
            
          callback(response);
        });
      })
      .end();
  }
}

module.exports = new weather();
