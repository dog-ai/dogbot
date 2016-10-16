/*
 * Copyright (C) 2016, Hugo Freire <hugo@dog.ai>. All rights reserved.
 */

const IOModule = require('./io-module')

const Promise = require('bluebird')
const locks = Promise.promisifyAll(require('locks'))

const Communication = require('../../utils/communication')
const Locale = require('../../utils/locale')
const Logger = require('../../utils/logger')

const path = require('path')
const stream = require('stream')
const spawn = require('child_process').spawn

const { Decoder } = require('lame')
const Speaker = require('speaker')

const record = require('node-record-lpcm16')
const { Detector, Models } = require('snowboy')

class Voice extends IOModule {
  constructor () {
    super('voice')
  }

  load () {
    switch (process.platform) {
      case 'linux':
        this._fallbackSpeak = this._execPico2Wave

        this._models = new Models()
        this._models.add({
          file: path.join(__dirname, '/../../../share/snowboy/raspberrypi/feedeobot.pmdl'),
          sensitivity: '0.5',
          hotwords: 'dog'
        })

        break
      case 'darwin':
        this._fallbackSpeak = this._execSay

        this._models = new Models()
        this._models.add({
          file: path.join(__dirname, '/../../../share/snowboy/macbookpro/dog.pmdl'),
          sensitivity: '0.5',
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

    this._detector = new Detector({
      resource: path.join(__dirname, '/../../../node_modules/snowboy/resources/common.res'),
      models: this._models,
      audioGain: 2.0
    })

    this._detector.on('hotword', () => this._listen())

    this._mic = record.start({ threshold: 0 })
    this._mic.pipe(this._detector)

    super.start({
      'io:voice:speak': this._speak.bind(this)
    })
  }

  stop () {
    record.stop()

    super.stop()
  }

  _speak ({ text }, callback) {
    return this._doSpeak(text)
      .then(() => callback())
      .catch(callback)
  }

  _doSpeak (text) {
    return this._speakMutex.lockAsync()
      .then(() => {
        return this._googleTTS(text)
          .catch(() => this._fallbackSpeak(text))
      })
      .finally(() => {
        this._speakMutex.unlock()
      })
  }

  _googleTTS (text) {
    return Communication.emitAsync('tts:stream', text)
      .then((stream) => {
        return new Promise((resolve, reject) => {
          const fileStream = require('fs')
            .createWriteStream(path.join(__dirname, '/../../../var/tmp/voice.mp3'))

          fileStream.on('finish', () => resolve())

          stream.on('error', (error) => {
            stream.end()

            reject(error)
          })

          stream.pipe(fileStream)
        })
      })
      .then(() => {
        const stream = new Decoder()
          .on('format', function (format) {
            this.pipe(new Speaker(format))
          })

        const fileStream = require('fs')
          .createReadStream(path.join(__dirname, '/../../../var/tmp/voice.mp3'))
        fileStream.pipe(stream)
      })
  }

  _listen () {
    if (this._listenMutex.isLocked) {
      return
    }

    return this._listenMutex.lockAsync()
      .then(() => this._doSpeak(Locale.get('yes')))
      .then(() => this._doListen())
      .then((text) => this._doSpeak(text))
      .catch((error) => {
        Logger.error(error)

        return this._doSpeak(Locale.get('error'))
          .catch(() => {})
      })
      .finally(() => this._listenMutex.unlock())
  }

  _execPico2Wave (text) {
    const file = path.join(__dirname, '/../../../var/tmp/voice.wav')

    return new Promise((resolve, reject) => {
      const _process = spawn('pico2wave', [
        '--wave=' + file,
        text
      ])
      _process.stderr.on('data', (data) => reject(new Error(data)))
      _process.on('error', reject)
      _process.on('close', () => resolve())
    })
      .then(() => this._execAplay(file))
  }

  _execAplay (file) {
    return new Promise((resolve, reject) => {
      const _process = spawn('aplay', [ file ])
      _process.stderr.on('data', (data) => reject(new Error(data)))
      _process.on('error', reject)
      _process.on('close', () => resolve())
    })
  }

  _execSay (text) {
    return new Promise((resolve, reject) => {
      const _process = spawn('say', [ text ])
      _process.stderr.on('data', (data) => reject(new Error(data)))
      _process.on('error', reject)
      _process.on('close', () => resolve())
    })
  }

  _doListen () {
    return new Promise((resolve, reject) => {
      const data = []
      const _stream = new stream.Writable({
        write: (chunk, encoding, next) => {
          data.push(chunk)

          next()
        }
      })

      const stop = () => {
        this._mic.unpipe(_stream)

        const buffer = Buffer.concat(data)

        super._onVoiceInput(buffer)
          .then((text) => resolve(text))
          .catch(reject)
      }

      this._mic.pipe(_stream)

      const timeout = setTimeout(() => stop(), 8000)

      setTimeout(() => {
        this._detector.once('silence', () => {
          clearTimeout(timeout)

          stop()
        })
      }, 1000)
    })
  }
}

module.exports = new Voice()
