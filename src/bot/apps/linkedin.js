/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function LinkedIn() {
}

LinkedIn.prototype.id = 'linkedin';

LinkedIn.prototype.databases = [];

LinkedIn.prototype.modules = [
  {type: 'social', name: 'linkedin'}
];

module.exports = new LinkedIn();