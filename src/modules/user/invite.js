/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const Module = require('../module')

const Server = require('../../server')

const moment = require('moment')

class Invite extends Module {
  constructor () {
    super('user', 'invite')
  }

  start () {
    super.start({
      'user:invite': this._invite.bind(this)
    })

    Server.emit('sync:outgoing:quickshot:register', {
      companyResource: 'invites',
      registerEvents: [ 'user:invite:sent' ],
      outgoingFunction: this._onInviteSent.bind(this)
    })
  }

  _invite (params, callback) {
    const invite = params.invite

    const envelope = {
      company: { id: invite.company.id },
      invite: { id: invite.id }
    }

    invite.url += '?envelope=' + this._encodeEnvelop(envelope)

    const email = {
      to: invite.email_address,
      from: 'noreply@dog.ai',
      fromname: 'Dog AI',
      subject: 'invite',
      text: 'invite',
      html: 'invite'
    }

    const templateId = 'b19fe16a-252a-41dc-85a5-e576313847cc'

    const substitutions = {
      ':userFullName': [ invite.user.full_name ],
      ':userFirstName': [ invite.user.full_name.split(' ')[ 0 ] ],
      ':companyName': [ invite.company.name ],
      ':url': [ invite.url ]
    }

    Server.emitAsync('email:send', email, templateId, substitutions)
      .then(() => {
        invite.sent_date = moment().format()

        callback()
      })
      .catch(callback)
      .finally(() => Server.emit('user:invite:sent', invite))
  }

  _encodeEnvelop (envelope) {
    return encodeURIComponent(new Buffer(unescape(encodeURIComponent(JSON.stringify(envelope)))).toString('base64'))
  }

  _onInviteSent (invite, callback) {
    invite.updated_date = moment().format()

    callback(null, invite)
  }
}

module.exports = new Invite()
