/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

var libnmap = require('node-libnmap');

function network() {
    var moduleManager = {};
}

network.prototype.type = "MONITOR";

network.prototype.name = "network";

network.prototype.info = function() {
    return "*" + this.name + "* - _Network monitor module_";
}

network.prototype.start = function() {
    /*libnmap.nmap('discover', function(err, report){
      if (err) throw err
      console.log(report)
    });*/
}

module.exports = new network();
