var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')
var Destructible = require('destructible')
var interrupt = require('interrupt').createInterrupter('staccato')

function Staccato (stream, opening) {
    this.stream = stream
    this._destructible = new Destructible(interrupt)
    this._listeners = {
        open: this._open.bind(this),
        error: this.destroy.bind(this)
    }
    this._destructible.markDestroyed(this)
    this._delta = null
    this._readable = false
    if (opening) {
        this._destructible.addDestructor('open', this, '_open')
    } else {
        this._open()
    }
    this.stream.once('error', this._listeners.error)
    this._destructible.addDestructor('error', this, '_uncatch')
    this.destroyed = false
}

Staccato.prototype._open = function () {
    this.stream.removeListener('open', this._listeners.open)
    this._opened = true
}

Staccato.prototype._uncatch = function () {
    this.stream.removeListener('error', this._listeners.error)
}

Staccato.prototype._cancel = function () {
    console.log('cancelling')
    if (this._delta != null) {
        this._delta.cancel([])
        this._delta = null
    }
}

Staccato.prototype.destroy = function () {
    this._destructible.destroy()
}

Staccato.prototype.ready = cadence(function (async) {
    interrupt.assert(!this.destroyed, 'destroyed')
    if (!this._opened) {
        async(function () {
            this._destructible.invokeDestructor('open')
            this._destructible.invokeDestructor('error')
            this._destructible.addDestructor('delta', this, '_cancel')
            this._delta = delta(async()).ee(this.stream).on('open')
        }, function () {
            this._delta = null
            this._destructible.invokeDestructor('delta')
            this.stream.once('error', this._listeners.error)
            this._destructible.addDestructor('error', this, '_uncatch')
        })
    }
})

module.exports = Staccato
