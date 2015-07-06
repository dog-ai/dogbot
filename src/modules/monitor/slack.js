/*
 * Copyright (C) 2015, Hugo Freire <hfreire@exec.sh>. All rights reserved.
 */

function slack() {
    var moduleManager = {};
    var cleanInterval = undefined;
}

slack.prototype.type = "MONITOR";

slack.prototype.name = "slack";

slack.prototype.info = function () {
    return "*" + this.name + "* - " +
        "_" + this.name.charAt(0).toUpperCase() + this.name.slice(1) + " " +
        this.type.toLowerCase() + " module_";
};

slack.prototype.load = function (moduleManager) {
    var self = this;

    this.moduleManager = moduleManager;

    this.moduleManager.emit('database:monitor:setup',
        "CREATE TABLE IF NOT EXISTS slack (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
        "created_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "updated_date DATETIME DEFAULT CURRENT_TIMESTAMP, " +
        "slack_id TEXT NOT NULL UNIQUE, " +
        "username TEXT NOT NULL, " +
        "name TEXT NOT NULL" +
        ");", [],
        function (error) {
            if (error !== undefined && error !== null) {
                throw new Error(error);
            } else {
                self.start();
            }
        });
};

slack.prototype.unload = function () {
    this.stop();
};

slack.prototype.start = function () {
    var self = this;

    this.discoverInterval = setInterval(function () {
        try {
            self._clean();
        } catch (error) {
            console.error(error);
        }
    }, 2 * 60 * 1000);

    this.moduleManager.on('io:slack:userIsAlreadyActive', function (user) {
        var that = self;

        var id = user.id;
        var username = user.name;
        var name = user.profile.real_name;
        self._retrieve(id, function (user) {
            if (user === undefined || user === null) {
                that._add(id, username, name);
            } else {
                that._update(id, username, name);
            }
        })
    });

    this.moduleManager.on('io:slack:userIsAlreadyAway', function (user) {
        var id = user.id;
        self._delete(id);
    });

    this.moduleManager.on('io:slack:userIsNowActive', function (user) {
        var that = self;

        var id = user.id;
        var username = user.name;
        var name = user.profile.real_name;
        self._retrieve(id, function (user) {
            if (user === undefined || user === null) {
                that._add(id, username, name);
            } else {
                that._update(id, username, name);
            }
        })
    });

    this.moduleManager.on('io:slack:userIsNowAway', function (user) {
        var id = user.id;
        self._delete(id);
    });
};

slack.prototype.stop = function () {
    clearInterval(this.cleanInterval);
};

slack.prototype._clean = function () {
    var currentDate = new Date();
    this._deleteAllByUpdatedDate(new Date(new Date().setMinutes(currentDate.getMinutes() - 5)));
};

slack.prototype._retrieve = function (slackId, callback) {
    this.moduleManager.emit('database:monitor:retrieve',
        "SELECT * FROM slack WHERE slack_id = ?;", [
            slackId
        ],
        function (error, row) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                callback(row);
            }
        });
};

slack.prototype._add = function (slackId, username, name) {
    var self = this;

    this.moduleManager.emit('database:monitor:create',
        "INSERT INTO slack (slack_id, username, name) VALUES (?, ?, ?);", [
            slackId,
            username,
            name
        ],
        function (error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                self.moduleManager.emit('person:slack:active', {slack_id: slackId, username: username, name: name});
            }
        });
};

slack.prototype._update = function (slackId, username, name) {
    var updatedDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:update',
        "UPDATE slack SET updated_date = ?, name = ?, username = ? WHERE slack_id = ?;", [
            updatedDate,
            name,
            username,
            slackId
        ],
        function (error) {
            if (error !== undefined && error !== null) {
                console.error(error);
            }
        });
};

slack.prototype._delete = function (slackId) {
    var self = this;
    this.moduleManager.emit('database:monitor:retrieve',
        "SELECT * FROM slack WHERE slack_id LIKE ?;", [slackId],
        function (error, row) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                var that = self;
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM slack WHERE slack_id = ?;", [slackId],
                    function (error) {
                        if (error !== undefined && error !== null) {
                            console.error(error);
                        } else {
                            if (row !== undefined && row !== null) {
                                that.moduleManager.emit('person:slack:away', {
                                    slack_id: row.slack_id,
                                    name: row.name,
                                    username: row.username
                                });
                            }
                        }
                    });
            }
        });
};

slack.prototype._deleteAllByUpdatedDate = function (oldestDate) {
    var self = this;

    var updatedDate = oldestDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    this.moduleManager.emit('database:monitor:retrieveAll',
        "SELECT * FROM slack WHERE updated_date < Datetime(?);", [updatedDate],
        function (error, row) {
            if (error !== undefined && error !== null) {
                console.error(error);
            } else {
                var that = self;
                self.moduleManager.emit('database:monitor:delete',
                    "DELETE FROM slack WHERE id = ?;", [row.id],
                    function (error) {
                        if (error !== undefined && error !== null) {
                            console.error(error);
                        } else {
                            that.moduleManager.emit('person:slack:away', {
                                slack_id: row.slack_id,
                                name: row.name,
                                username: row.username
                            });
                        }
                    });
            }
        });
};

module.exports = new slack();
