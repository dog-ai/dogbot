/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const AutomateModule = require('./automate-module')

const Bot = require('../../bot')

const { Logger } = require('../../utils')

const GitHubWrapper = require('@dog-ai/github-wrapper')

const mergeGreenkeeperPullRequests = function (params, callback) {
  const owner = this.options.greenkeeper.merge_owner

  return this.wrapper.mergeGreenkeeperPullRequests(owner)
    .catch((error) => Logger.error(error))
    .finally(() => callback())
}

class GitHub extends AutomateModule {
  constructor () {
    super('github')
  }

  load (options = {}) {
    this.options = options

    if (!this.options.api_token || !this.options.greenkeeper || !this.options.greenkeeper.merge_owner) {
      throw new Error('api token not available')
    }

    const token = this.options.api_token
    this.wrapper = new GitHubWrapper({ auth: { type: 'token', token } })

    super.load()
  }

  unload () {
    super.unload()

    if (this.wrapper) {
      delete this.wrapper
    }
  }

  start () {
    super.start({
      'automate:github:greenkeeper:merge': mergeGreenkeeperPullRequests.bind(this)
    })

    Bot.enqueueJob('automate:github:greenkeeper:merge', null, { schedule: '30 minutes' })
  }

  stop () {
    Bot.dequeueJob('automate:github:greenkeeper:merge')

    super.stop()
  }
}

module.exports = new GitHub()
