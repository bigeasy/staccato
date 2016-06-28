var stream = require('stream'),
    cadence = require('cadence'),
    Delta = require('delta')

function Staccato (stream, opening) {
    this._opened = !opening
// TODO Expose stream.
    this._stream = stream
    this._catcher = function (error) { this._error = error }.bind(this)
    this._readable = false
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
            new Delta(async()).ee(this._stream).on('open')
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

Staccato.prototype.read = cadence(function (async) {
    var waited = false
    var loop = async(function () {
        if (!this._readable) {
            waited = true
            new Delta(async()).ee(this._stream).on('readable')
        }
    }, function () {
        this._readable = true
        var object = this._stream.read()
        if (object == null) {
            if (waited) {
                return [ loop.break, null ]
            } else {
                this._readable = false
            }
        } else {
            return [ loop.break, object ]
        }
    })()
})

Staccato.prototype.write = cadence(function (async, buffer) {
    this._checkError()
    if (!this._stream.write(buffer)) { // <- does this 'error' if `true`?
        async(function () {
            this._stream.removeListener('error', this._catcher)
            new Delta(async()).ee(this._stream).on('drain')
        }, function () {
            this._stream.once('error', this._catcher)
        })
    }
})

Staccato.prototype.close = cadence(function (async) {
    this._checkError() // <- would `error` be here?
    async(function () {
        this._stream.removeListener('error', this._catcher)
        new Delta(async()).ee(this._stream).on('finish')
        this._stream.end()
    }, function () {
        this._error = new Error('closed')
    })
})

module.exports = Staccato
