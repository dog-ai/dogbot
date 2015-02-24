n/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var https = require('https');

var options = {
  host: 'api.openweathermap.org',
  port: 80,
  path: '/data/2.5/weather?q=stockholm,sweden',
  method: 'GET'
};

function products() {
  var moduleManager = {};
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

products.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;
}

products.prototype.unload = function() {
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
