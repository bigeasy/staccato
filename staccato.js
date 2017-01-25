var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')

function Staccato (stream, opening) {
    this.destroyed = false
    this._onceOpen = null
    this.stream = stream
    this._catcher = function (error) { this._error = error }.bind(this)
    this._delta = null
    this._readable = false
    if (opening) {
        this.stream.once('open', this._onceOpen = function () {
            this._onceOpen = null
        }.bind(this))
    }
    this.stream.once('error', this._catcher)
}

Staccato.prototype.destroy = function () {
    this.destroyed = true
    if (this._onceOpen != null) {
        this.stream.removeListener('open', this._onceOpen)
    }
    if (this._delta != null) {
        this._delta.cancel([])
    }
    this.stream.removeListener('error', this._catcher)
}

Staccato.prototype.ready = cadence(function (async) {
    this._checkError()
    if (this._onceOpen != null) {
        this.stream.removeListener('open', this._onceOpen)
        async(function () {
            this.stream.removeListener('error', this._catcher)
            this._delta = delta(async()).ee(this.stream).on('open')
        }, function () {
            this._delta = null
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
            this._delta = delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        this._delta = null
        if (this.destroyed) {
            return [ loop.break, null ]
        }
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
