var stream = require('stream'),
    cadence = require('cadence')

function Staccato (stream, opening) {
    this._opened = !opening
    this._stream = stream
    this._catcher = function (error) { this._error = error }.bind(this)
    if (!this._opened) {
        this._stream.once('open', function () {
            this._opened = true
        }.bind(this))
    }
    this._stream.once('error', this._catcher)
}

Staccato.prototype.ready = cadence(function (async) {
    this._checkError()
    if (!this._opened) {
        async(function () {
            this._stream.removeListener('error', this._catcher)
            async.ee(this._stream).end('open').error()
        }, function () {
            this._stream.once('error', this._catcher)
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

Staccato.prototype.write = cadence(function (async, buffer) {
    this._checkError()
    if (!this._stream.write(buffer)) { // <- does this 'error' if `true`?
        async(function () {
            this._stream.removeListener('error', this._catcher)
            async.ee(this._stream).end('drain').error()
        }, function () {
            this._stream.once('error', this._catcher)
        })
    }
})

Staccato.prototype.close = cadence(function (async) {
    this._checkError() // <- would `error` be here?
    async(function () {
        this._stream.removeListener('error', this._catcher)
        async.ee(this._stream).end('finish').error()
        this._stream.end()
    }, function () {
        this._error = new Error('closed')
    })
})

module.exports = Staccato
