// Node.js API.
var stream = require('stream')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Exceptions you can catch by type.
var interrupt = require('interrupt').createInterrupter('staccato')

// Return the first not null-like value.
var coalesce = require('extant')

function Staccato (stream, opening) {
    this.stream = stream
    this._listeners = {}
    this._delta = null
    this._error = null
    this._readable = false
    if (opening) {
        this._once('open', this._open.bind(this))
    } else {
        this._opened = true
    }
    this._once('error', this._catch.bind(this))
    this.destroyed = false
}

Staccato.prototype._once = function (name, listener) {
    this._listeners[name] = listener
    this.stream.once(name, listener)
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
        for (var name in this._listeners) {
            this.stream.removeListener(name, this._listeners[name])
        }
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
