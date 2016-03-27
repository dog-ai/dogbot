/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

var moment = require('moment')
_ = require('lodash')

var utils = require('../utils.js')

function Invite() {
}

Invite.prototype.type = 'user'

Invite.prototype.name = 'invite'

Invite.prototype.events = {}

Invite.prototype.load = function (communication) {
  this.communication = communication

  this.start()
}

Invite.prototype.unload = function () {
  this.stop()
}

Invite.prototype.start = function () {
  utils.startListening.bind(this)({
    'user:invite': this._invite.bind(this)
  })

  this.communication.emit('sync:outgoing:quickshot:register', {
    companyResource: 'invites',
    registerEvents: ['user:invite:sent'],
    outgoingFunction: this._onInviteSent
  })
}

Invite.prototype.stop = function () {
  utils.stopListening.bind(this)([
    'user:invite'
  ])
}

Invite.prototype._invite = function (params, callback) {
  var _this = this

  var invite = params.invite

  var envelope = {
    company: {id: invite.company.id},
    invite: {id: invite.id}
  }

  invite.url += '?envelope=' + this._encodeEnvelop(envelope)

  var email = {
    to: invite.email_address,
    from: 'noreply@dog.ai',
    fromname: 'Dog AI',
    subject: 'invite',
    text: 'invite',
    html: 'invite'
  }

  var templateId = 'b19fe16a-252a-41dc-85a5-e576313847cc'

  var substitutions = {
    ':userFullName': [invite.user.full_name],
    ':userFirstName': [invite.user.full_name.split(' ')[0]],
    ':companyName': [invite.company.name],
    ':url': [invite.url]
  }

  this.communication.emitAsync('email:send', email, templateId, substitutions)
    .then(function () {
      invite.sent_date = moment().format()
      callback()
    })
    .catch(callback)
    .finally(function () {
      _this.communication.emit('user:invite:sent', invite)
    })
}

Invite.prototype._encodeEnvelop = function (envelope) {
  return encodeURIComponent(new Buffer(unescape(encodeURIComponent(JSON.stringify(envelope)))).toString('base64'))
}

Invite.prototype._onInviteSent = function (invite, callback) {
  invite.updated_date = moment().format()

  callback(null, invite)
}

module.exports = new Invite()
