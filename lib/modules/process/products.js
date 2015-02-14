/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var https = require('https');

var options = {
  host: 'products.feedeo.io',
  port: 443,
  path: '/api/projects/724834;source=354/products?size=1&random=true',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + new Buffer('feedeo-custom1:C5Feg8bzWmc7TVzTzhzvXC56PT9AH2FN').toString('base64')
  }
};

function products() {
  var bot = {};
}

products.prototype.type = "PROCESS";

products.prototype.name = "products";

products.prototype.info = function() {
  return "*" + this.name +"* - _Feedeo Product Service processing module_";
}

products.prototype.help = function() {
  var help = '';

  help += '*!products get random* - _Retrieve a random product_'

  return help;
}

products.prototype.process = function(message, callback) {

  if (message === "!products get random") {
    https.request(options, function(response) {
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
