var https = require('https');

function products()  {
}

products.prototype.process = function(type, channel, user, time, text, response) {
}

module.exports = new products();

/*
var options = {
          host: 'products.feedeo.io',
          port: 443,
          path: '/api/projects/724834;source=354/products?size=1&random=true',
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + new Buffer('feedeo-custom1:C5Feg8bzWmc7TVzTzhzvXC56PT9AH2FN').toString('base64')
          }
        };

        callback = function(response) {
          var str = '';
          response.on('data', function (chunk) {
            str += chunk;
          });
          response.on('end', function () {
            var page = JSON.parse(str);
            var product = page.content[0];
            console.log(product);
          });
        }
        https.request(options, callback).end();
        */
