/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function Slack() {
}

Slack.prototype.id = 'slack';

Slack.prototype.databases = [];

Slack.prototype.modules = [
    {type: 'io', name: 'slack'}
];

module.exports = new Slack();