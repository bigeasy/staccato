var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')
var interrupt = require('interrupt').createInterrupter('staccato')
var coalesce = require('extant')

function Staccato (stream, opening) {
    this.stream = stream
    this._listeners = { open: this._open.bind(this), error: this._catch.bind(this) }
    this._delta = null
    this._error = null
    this._readable = false
    if (opening) {
        stream.on('open', this._listeners.open)
    } else {
        this._opened = true
    }
    this.stream.once('error', this._listeners.error)
    this.destroyed = false
}

Staccato.prototype._catch = function (error) {
    this._destroy([ this._error = error ])
}

Staccato.prototype._open = function () {
    this.stream.removeListener('open', this._listeners.open)
    this._opened = true
}

Staccato.prototype.destroy = function () {
    this._destroy([])
}

Staccato.prototype._destroy = function (vargs) {
    if (!this.destroyed) {
        this.destroyed = true
        this.stream.removeListener('open', this._listeners.open)
        this.stream.removeListener('error', this._listeners.error)
        if (this._delta) {
            this._delta.cancel(vargs)
        }
    }
}

Staccato.prototype.ready = cadence(function (async) {
    interrupt.assert(!this.destroyed, 'destroyed')
    if (!this._opened) {
        async(function () {
            this._delta = delta(async()).ee(this.stream).on('open')
        }, function () {
            this._delta = null
        })
    }
})

module.exports = Staccato
