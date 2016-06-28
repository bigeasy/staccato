var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')

function Staccato (stream, opening) {
    this._opened = !opening
// TODO Expose stream.
    this.stream = stream
    this._catcher = function (error) { this._error = error }.bind(this)
    this._readable = false
    if (!this._opened) {
        this.stream.once('open', function () {
            this._opened = true
        }.bind(this))
    }
    this.stream.once('error', this._catcher)
}

Staccato.prototype.ready = cadence(function (async) {
    this._checkError()
    if (!this._opened) {
        async(function () {
            this.stream.removeListener('error', this._catcher)
            delta(async()).ee(this.stream).on('open')
        }, function () {
            this.stream.once('error', this._catcher)
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
            delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        this._readable = true
        var object = this.stream.read()
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
    if (!this.stream.write(buffer)) { // <- does this 'error' if `true`?
        async(function () {
            this.stream.removeListener('error', this._catcher)
            delta(async()).ee(this.stream).on('drain')
        }, function () {
            this.stream.once('error', this._catcher)
        })
    }
})

Staccato.prototype.close = cadence(function (async) {
    this._checkError() // <- would `error` be here?
    async(function () {
        this.stream.removeListener('error', this._catcher)
        delta(async()).ee(this.stream).on('finish')
        this.stream.end()
    }, function () {
        this._error = new Error('closed')
    })
})

module.exports = Staccato
