/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function intelligence() {
}

intelligence.prototype.name = 'brain';

intelligence.prototype.databases = [];

intelligence.prototype.modules = [
    {type: 'nlp', name: 'wit'}
];

module.exports = new intelligence();