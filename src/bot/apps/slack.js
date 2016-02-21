/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function slack() {
}

slack.prototype.name = 'slack';

slack.prototype.databases = [];

slack.prototype.modules = [
    {type: 'io', name: 'slack'}
];

module.exports = new slack();