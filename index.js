var fs = require('fs'),
    stream = require('stream'),
    cadence = require('cadence')


/*function Staccato (file, flags, position) {
    this._file = file
    this._position = position
    this._stream = fs.createWriteStream(this._file, {
        flags: flags,
        mode: 0644,
        start: this._position
    }).once('open', function (error) {
        this._opened = true
    }.bind(this))
}*/

function Staccato (stream, opening) {
    this._opened = !opening
    this._stream = stream
    this._catcher = function (error) { this._error = error }.bind(this)
    if (!this._opened) {
        this._stream.once('open', function () {
            this._opened = true
        }.bind(this)).once('error', this._catcher)
    }
}

Staccato.prototype.ready = cadence(function (step) {
    this._checkError()
    if (!this._opened) {
        var error
        step(function () {
            this._stream.removeListener('error', this._catcher)
            this._stream.once('open', step(-1))
            this._stream.once('error', error = step(Error))
        }, function () {
            this._stream.removeListener('error', error)
        })
    }
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
        var error
        step(function () {
            this._stream.removeListener('error', this._catcher)
            this._stream.once('drain', step(-1))
            this._stream.once('error', error = step(Error))
        }, function () {
            this._stream.removeListener('error', error)
            this._stream.once('error', this._catcher)
        })
    }
})

Staccato.prototype.close = cadence(function (step) {
    this._checkError() // <- would `error` be here?
    var error
    step(function () {
        this._stream.removeListener('error', this._catcher)
        this._stream.end(step())
        this._stream.once('error', error = step(Error)) // <- will this called?
    }, function () {
        this._stream.removeListener('error', error)
        this._error = new Error('closed')
    })
})

module.exports = Staccato
