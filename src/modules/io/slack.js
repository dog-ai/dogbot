/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Promise = require('bluebird')

const Logger = require('../../utils/logger')

const Botkit = require('botkit')
const slackbot = Botkit.slackbot({ log: false })

class Slack extends IOModule {
  constructor () {
    super('slack')
  }

  load (communication, config) { // TODO: remove communication
    if (!config.api_token) {
      throw new Error('missing required API token')
    }

    this._client = slackbot.spawn({ token: config.api_token })

    slackbot.on([ 'direct_message', 'mention', 'direct_mention' ], (bot, message) => {
      const reaction = { timestamp: message.ts, channel: message.channel, name: 'robot_face' }
      bot.api.reactions.add(reaction, (error) => {
        if (error) {
          Logger.error(error)

          return
        }

        bot.reply(message, `Not now! I'm busy learning new tricks.`)
      })
    })

    super.load()
  }

  unload () {
    super.unload()

    this._client.destroy()
  }

  start () {
    return new Promise((resolve, reject) => {
      slackbot.on('rtm_open', () => {})

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
    return new Promise((resolve, reject) => {
      slackbot.on('rtm_close', () => {
        resolve()
      })

      this._client.closeRTM()

      setTimeout(reject, 5000)
    })
      .then(() => {
        super.stop()
      })
  }
}

module.exports = new Slack()
