// Node.js API.
var stream = require('stream')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Return the first not null-like value.
var coalesce = require('extant')

function Staccato (stream) {
    this.stream = stream
    this._listeners = {}
    this._delta = null
    this._error = null
    this._readable = false
    this._once('error', this._catch.bind(this))
    this.destroyed = false
}

Staccato.CANCELLED = {}

Staccato.prototype._once = function (name, listener) {
    this._listeners[name] = listener
    this.stream.once(name, listener)
}

Staccato.prototype._catch = function (error) {
    this._destroy([ this._error = error ])
}

Staccato.prototype.destroy = function () {
    this._destroy([ null, Staccato.CANCELLED ])
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

module.exports = Staccato
