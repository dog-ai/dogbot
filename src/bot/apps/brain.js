/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function brain() {
}

brain.prototype.name = 'brain';

brain.prototype.databases = [];

brain.prototype.modules = [
    {type: 'nlp', name: 'wit'},
    {type: 'action', name: 'slap'}
];

module.exports = new brain();