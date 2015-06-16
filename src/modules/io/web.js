/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

var express = require('express');
var server = express();
var passport = require('passport');

function web() {}

web.prototype.type = "IO";

web.prototype.name = "web";

web.prototype.info = function() {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
         "I/O module_";
}

web.prototype.load = function(moduleManager) {
    this.moduleManager = moduleManager;

    server.use(express.static('public'));
    server.use(passport.initialize());
    server.use(passport.session());

    server.listen(8082);

    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    server.all('/', function(req, res) {
        return res.send();
    });
}

web.prototype.unload = function() {}

web.prototype.send = function(recipient, message) {}

web.prototype.registerAuthStrategy = function(name, authStrategy) {
    passport.use(authStrategy);

    server.get('/auth/' + name, passport.authenticate(name, {
        session: false,
        accessType: 'offline',
        approvalPrompt: 'force',
    }));

    server.get('/auth/' + name +'/callback',
        passport.authenticate(name, {
            session: false,
            failureRedirect: '/auth/' + name +'/failure'
        }),
        function(req, res) {
            res.redirect('/');
        });
}

module.exports = new web();
