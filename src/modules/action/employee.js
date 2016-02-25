/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

function employee() {
    var moduleManager = {};
}

employee.prototype.type = "PROCESS";

employee.prototype.name = "employee";

employee.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

employee.prototype.help = function () {
    var help = '';

    help += '*!employees* - _List known employees_';

    return help;
};

employee.prototype.load = function (moduleManager) {
    this.moduleManager = moduleManager;
};

employee.prototype.unload = function () {
};

employee.prototype.process = function (message, callback) {
    if (message.substring(0, "!employees".length) === "!employees") {
        this._retrieve(callback);
    }
};

employee.prototype._retrieve = function (callback) {
    this.moduleManager.emit('database:person:retrieveOneByOne',
        "SELECT * FROM employee ORDER BY name ASC;", [],
        function (error, row) {
            if (error) {
                throw error;
            } else {
                if (row) {
                    callback(row.name);
                }
            }
        });
};

module.exports = new employee();
