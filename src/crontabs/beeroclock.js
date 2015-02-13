/*
 * Copyright (C) 2015, Feedeo AB. All rights reserved.
 */

function beeroclock() {}

beeroclock.prototype.info = function() {
  return '*beeroclock* - _Advertise beer o\'clock every friday at 16:00_';
}

beeroclock.prototype.time = "0 16 * * 5";

beeroclock.prototype.function = function(modules, slack) {
  var channel = slack.getChannelByName('#feedeo');

  var text = '*It is Beer o\'clock!*' + '\n' +
  'https://lygsbtd.files.wordpress.com/2011/08/beer_toast.jpg?' + Math.random() +  '\n' +
  'Well done guys! You\'ve managed to survive another week, go and grab yourselves a beer!';

  channel.send(text);
}

module.exports = new beeroclock();
