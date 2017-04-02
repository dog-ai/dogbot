/*
 * Copyright (C) 2017, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const AutomationModule = require('./automation-module')

class GitHubAutomationModule extends AutomationModule {
  load (options = {}) {
    this.options = options

    if (!this.options.api_token) {
      throw new Error('api token not available')
    }
  }
}

module.exports = GitHubAutomationModule
