/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Promise = require('bluebird')

const Logger = require('../../utils/logger')

const Botkit = require('botkit')
const slackbot = Botkit.slackbot({ log: false })

slackbot.on([ 'direct_message', 'mention', 'direct_mention' ], (bot, message) => {
  const reaction = { timestamp: message.ts, channel: message.channel, name: 'robot_face' }
  bot.api.reactions.add(reaction, (error) => {
    if (error) {
      Logger.warn(error)

      return
    }

    bot.reply(message, `Not now! I'm busy learning new tricks.`)
  })
})

slackbot.on('rtm_open', () => {})

class Slack extends IOModule {
  constructor () {
    super('slack')
  }

  load (communication, config) { // TODO: remove communication
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

        return resolve(bot, payload)
      })
    })
      .then(() => {
        super.start()
      })
  }

  stop () {
    return Promise.resolve()
      .then(() => {
        this._client.closeRTM()

        super.stop()
      })
  }
}

module.exports = new Slack()
