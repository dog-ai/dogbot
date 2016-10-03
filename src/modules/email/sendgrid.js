/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const SENDGRIND_API_KEY = process.env.SENDGRID_API_KEY

var utils = require('../utils.js');

function SendGrid() {
}

SendGrid.prototype.type = "email";

SendGrid.prototype.name = "sendgrid";

SendGrid.prototype.events = {};

SendGrid.prototype.load = function (communication) {
  this.communication = communication;

  this._client = require('sendgrid')(SENDGRIND_API_KEY);

  this.start();
};

SendGrid.prototype.unload = function () {
  this.stop();
};

SendGrid.prototype.start = function () {
  utils.startListening.bind(this)({
    'email:send': this._send.bind(this)
  });
};

SendGrid.prototype.stop = function () {
  utils.stopListening.bind(this)([
    'email:send'
  ]);
};

SendGrid.prototype._send = function (email, templateId, substitutions, callback) {
  email = new this._client.Email(email);
  email.setFilters({
    'templates': {
      'settings': {
        'enable': 1,
        'template_id': 'b19fe16a-252a-41dc-85a5-e576313847cc'
      }
    }
  });
  email.setSubstitutions(substitutions);

  this._client.send(email, callback);
};

module.exports = new SendGrid();
