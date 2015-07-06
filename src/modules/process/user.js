/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function user() {
    var moduleManager = {};
}

user.prototype.type = "PROCESS";

user.prototype.name = "user";

user.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

user.prototype.help = function () {
    var help = '';

    help += '*!users* - _List known users_';

    return help;
};

user.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;
};

user.prototype.unload = function () {
};

user.prototype.process = function (message, callback) {
    if (message.substring(0, "!users".length) === "!users") {
        this._retrieve(callback);
    }
};

user.prototype._retrieve = function (callback) {
    this.moduleManager.emit('database:person:retrieveAll',
        "SELECT * FROM user ORDER BY name ASC;", [],
        function (error, row) {
            if (error !== null) {
                throw error;
            } else {
                if (row !== undefined) {
                    callback(row.name);
                }
            }
        });
};

module.exports = new user();
