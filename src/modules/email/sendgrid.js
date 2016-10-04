/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const SENDGRIND_API_KEY = process.env.SENDGRID_API_KEY

const Module = require('../module')

class SendGrid extends Module {
  constructor () {
    super('email', 'sendgrid')
  }

  load () {
    this._client = require('sendgrid')(SENDGRIND_API_KEY)

    super.load()
  }

  start () {
    this._startListening.bind(this)({
      'email:send': this._send.bind(this)
    })
  }

  stop () {
    this._stopListening.bind(this)([
      'email:send'
    ])
  }

  _send (email, templateId, substitutions, callback) {
    email = new this._client.Email(email)

    email.setFilters({
      templates: {
        settings: {
          enable: 1,
          template_id: 'b19fe16a-252a-41dc-85a5-e576313847cc'
        }
      }
    })

    email.setSubstitutions(substitutions)

    this._client.send(email, callback)
  }
}

module.exports = new SendGrid()
