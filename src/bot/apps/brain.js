/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function Brain() {
}

Brain.prototype.id = 'brain';

Brain.prototype.databases = [];

Brain.prototype.modules = [
  {type: 'nlp', name: 'wit'},
  {type: 'action', name: 'slap'},
  {type: 'email', name: 'sendgrid'},
  {type: 'user', name: 'invite'}
];

module.exports = new Brain();