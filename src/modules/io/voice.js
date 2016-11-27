/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Promise = require('bluebird')
const TimeoutError = Promise.TimeoutError
const locks = Promise.promisifyAll(require('locks'))

const { Communication, Locale, Logger } = require('../../utils')

const createReadStream = require('fs').createReadStream
const path = require('path')
const spawn = require('child_process').spawn

const record = require('node-record-lpcm16')
const { Detector, Models } = require('snowboy')

const execPico2WaveCommand = (text) => {
  const execPlayCommand = (file) => {
    return new Promise((resolve, reject) => {
      const child = spawn('play', [ '-q', file ])
      child.stderr.on('data', (data) => reject(new Error(data)))
      child.on('error', reject)
      child.on('close', () => resolve())
    })
  }

  const file = path.join(__dirname, '/../../../var/tmp/voice.wav')

  return new Promise((resolve, reject) => {
    const child = spawn('pico2wave', [
      '--wave=' + file,
      text
    ])

    const timeout = setTimeout(() => {
      child.stderr.pause()
      child.kill()

      reject(new TimeoutError())
    }, 8000)

    child.stderr.on('data', (data) => {
      clearTimeout(timeout)

      reject(new Error(data))
    })
    child.on('error', (error) => {
      clearTimeout(timeout)

      reject(error)
    })
    child.on('close', () => {
      clearTimeout(timeout)

      resolve()
    })
  })
    .then(() => execPlayCommand(file))
}

const execSayCommand = (text) => {
  return new Promise((resolve, reject) => {
    const child = spawn('say', [ text ])

    const timeout = setTimeout(() => {
      child.stderr.pause()
      child.kill()

      reject(new TimeoutError())
    }, 8000)

    child.stderr.on('data', (data) => {
      clearTimeout(timeout)

      reject(new Error(data))
    })
    child.on('error', (error) => {
      clearTimeout(timeout)

      reject(error)
    })
    child.on('close', () => {
      clearTimeout(timeout)

      resolve()
    })
  })
}

const execPlayCommand = (stream, format = 'wav') => {
  return new Promise((resolve, reject) => {
    const child = spawn('play', [ '-q', '-t', format, '-' ], { stdio: [ 'pipe' ] })

    const timeout = setTimeout(() => {
      child.stderr.pause()
      child.kill()

      reject(new TimeoutError())
    }, 8000)

    child.stderr.on('data', (data) => {
      clearTimeout(timeout)

      reject(new Error(data))
    })
    child.on('error', (error) => {
      clearTimeout(timeout)

      reject(error)
    })
    child.on('close', () => {
      clearTimeout(timeout)

      resolve()
    })

    stream.pipe(child.stdin)
  })
}

const playAudio = (file) => {
  const stream = createReadStream(path.join(__dirname, `/../../../share/dogbot/voice/${file}`))
  return execPlayCommand(stream)
}

const captureAudio = (maxPeriod = 8000) => {
  return playAudio('listen.wav')
    .then(() => {
      let stream
      try {
        stream = record.start({ threshold: 0.9 })
      } catch (error) {
        throw error
      }

      const timeout = setTimeout(record.stop, maxPeriod)
      stream.once('end', () => {
        clearTimeout(timeout)

        playAudio('success.wav')
      })

      return stream
    })
    .catch((error) => {
      playAudio('failure.wav')

      throw error
    })
}

class Voice extends IOModule {
  constructor () {
    super('voice')
  }

  load () {
    switch (process.platform) {
      case 'linux':
        this._fallbackSpeak = execPico2WaveCommand

        this._models = new Models()
        this._models.add({
          file: path.join(__dirname, '/../../../share/snowboy/raspberrypi/default.pmdl'),
          sensitivity: '0.45',
          hotwords: 'dog'
        })

        break
      case 'darwin':
        this._fallbackSpeak = execSayCommand

        this._models = new Models()
        this._models.add({
          file: path.join(__dirname, '/../../../share/snowboy/macbookpro/default.pmdl'),
          sensitivity: '0.45',
          hotwords: 'dog'
        })

        break
      default:
        throw new Error(process.platform + ' platform is not supported')
    }

    super.load()
  }

  start () {
    this._speakMutex = locks.createMutex()
    this._listenMutex = locks.createMutex()
    this._hotwordMutex = locks.createMutex()

    this._detector = new Detector({
      resource: path.join(__dirname, '/../../../node_modules/snowboy/resources/common.res'),
      models: this._models,
      audioGain: 2.0
    })

    this._detector.on('hotword', () => this._onHotword())

    this._mic = record.start({ threshold: 0 })
    this._mic.pipe(this._detector)

    super.start({
      'io:voice:speak': this.speak.bind(this),
      'io:voice:listen': this.listen.bind(this)
    })
  }

  stop () {
    super.stop()

    record.stop()
  }

  speak ({ text }, callback = () => {}) {
    this._speak(text)
      .then(() => callback())
      .catch(callback)
  }

  _speak (text) {
    const googleTTS = (text) => {
      return Communication.emitAsync('tts:stream', { text })
        .then((stream) => execPlayCommand(stream, 'mp3'))
    }

    return this._speakMutex.lockAsync()
      .then(() => {
        return googleTTS(text)
          .catch((error) => {
            Logger.warn(error)

            return this._fallbackSpeak(text)
          })
      })
      .finally(() => this._speakMutex.unlock())
  }

  _onHotword () {
    return this._hotwordMutex.lockAsync()
      .then(() => Communication.emit('io:slack:text', { text: 'yes' }))
      /* .then(() => {
        this._mic.unpipe(this._detector)
        record.stop()
      })
       .then(() => captureAudio.bind(this)())
      .then((stream) => {
        return super._onVoiceInput(stream)
          .then((text) => {
            Communication.emit('io:slack:text', { text: `I just heard: ${text}` })

            return super._onTextInput(text)
          })
      })
      .then((text) => {
        Communication.emit('io:slack:text', { text: `I've answered: ${text}` })

        return this._speak(text)
       }) */
      .catch((error) => {
        Logger.error(error)

        return this._speak(Locale.get('error'))
          .catch(() => {})
      })
      .finally(() => {
        // this._mic = record.start({ threshold: 0 })
        // this._mic.pipe(this._detector)

        this._hotwordMutex.unlock()
      })
  }

  listen ({ maxPeriod }, callback = () => {}) {
    this._listen(maxPeriod)
      .then((text) => callback(text))
      .catch(callback)
  }

  _listen (maxPeriod) {
    return this._listenMutex.lockAsync()
      .then(() => captureAudio.bind(this)(maxPeriod))
      .then((stream) => {
        return super._onVoiceInput(stream)
          .then((text) => super._onTextInput(text))
      })
      .finally(() => this._listenMutex.unlock())
  }
}

module.exports = new Voice()

