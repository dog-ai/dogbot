/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var fs = require("fs");
var sqlite3 = require("sqlite3").verbose();

var file = __dirname + "/../feedeobot.db";
var db = new sqlite3.Database(file);

var database = {
    initialize: function() {
        db.serialize(function() {
          db.run("CREATE TABLE bonjour(id INT PRIMARY KEY NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, ip TEXT NOT NULL, port INT);");
        });
    }
}

if (!fs.existsSync(file)) {
    database.initialize();
}

exports.module = database;
