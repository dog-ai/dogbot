/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Promise = require('bluebird')

const Botkit = require('botkit')
const slackbot = Botkit.slackbot({ log: false })

class Slack extends IOModule {
  constructor () {
    super('slack')

    slackbot.on([ 'direct_message', 'mention', 'direct_mention' ], (bot, message) => {
      bot.startTyping(message)

      let reaction = { timestamp: message.ts, channel: message.channel, name: 'robot_face' }
      bot.api.reactions.add(reaction)
    })

    slackbot.on('rtm_open', () => {})
  }

  load (config) {
    if (!config.api_token) {
      throw new Error('Missing required API token')
    }

    this._client = slackbot.spawn({ token: config.api_token, retry: Infinity })

    super.load()
  }

  unload () {
    super.unload()

    this._client.destroy()
  }

  start () {
    return new Promise((resolve, reject) => {
      this._client.startRTM((error, bot, payload) => {
        if (error) {
          return reject(error)
        }

        this._bot = bot

        return resolve(bot, payload)
      })
    })
      .then(() => {
        super.start({
          'io:slack:text': this.text.bind(this)
        })
      })
  }

  stop () {
    return Promise.resolve()
      .then(() => {
        delete this._bot

        this._client.closeRTM()

        super.stop()
      })
  }

  text ({ text }, callback = () => {}) {
    this._bot.startPrivateConversation({
      user: 'U2K057TDF',
      channel: 'D2K83C4JF'
    }, (error, conversation) => {
      if (error) {
        return callback(error)
      }

      conversation.say(text)

      callback()
    })
  }
}

module.exports = new Slack()
