/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var client = require('https');

var options = {
  host: 'products.feedeo.io',
  port: 443,
  path: '/api/projects/724834;source=354/products?size=1&random=true',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + new Buffer('feedeo-custom1:C5Feg8bzWmc7TVzTzhzvXC56PT9AH2FN').toString('base64')
  }
};

function products() {}

products.prototype.help = function() {
  var help = '';

  help += '*!products get random*\t\t\t\t\t\t(Retrieve a random product from Feedeo)'

  return help;
}

products.prototype.process = function(type, channel, user, time, text, callback) {

  if (text === "!products get random") {
    client.request(options, function(response) {
        var str = '';
        response.on('data', function(chunk) {
          str += chunk;
        });
        response.on('end', function() {
          var page = JSON.parse(str);
          var product = page.content[0];

          var response = product.properties.imageUrl + '\n' +
            product.properties.modelName + '\n' +
            '*' + product.properties.priceWithTax / 100 + ' SEK*' + '\n' +
            '```' + product.properties.productUrl + '```';

          callback(response);
        });
      })
      .end();
  }
}

module.exports = new products();
