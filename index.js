var fs = require('fs'),
    cadence = require('cadence')

function Staccato (file, flags, position) {
    this._file = file
    this._position = position
    this._stream = fs.createWriteStream(this._file, {
        flags: flags,
        mode: 0644,
        start: this._position
    }).once('open', function (error) {
        this._opened = true
    }.bind(this))
}

Staccato.prototype.ready = cadence(function (step) {
    step(function () {
        if (!this._opened) {
            this._stream.once('open', step(-1))
            this._stream.once('error', step(Error))
        }
    }, function () {
        this._stream.removeAllListeners('error')
        this._stream.on('error', function (error) {
            this._error = error
        }.bind(this))
    })
})

Staccato.prototype._checkError = function () {
    if (this._error) {
        var error = this._error
        this._error = new Error('already errored')
        throw error
    }
}

Staccato.prototype.write = cadence(function (step, buffer) {
    this._checkError()
    if (!this._stream.write(buffer)) { // <- does this 'error' if `true`?
        step(function () {
            this._stream.once('drain', step(-1))
            this._stream.once('error', step(Error))
        }, function () {
            this._stream.removeAllListeners('error')
        })
    }
})

Staccato.prototype.close = cadence(function (step) {
    step(function () {
        this._checkError() // <- would `error` be here?
        this._stream.removeAllListeners('error')
        this._stream.end(step())
        this._stream.once('error', step(Error)) // <- will this called?
    }, function () {
        this._stream.removeAllListeners('error')
        this._error = new Error('closed')
    })
})

module.exports = Staccato
