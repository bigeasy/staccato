var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')
var Destructor = require('destructible')
var interrupt = require('interrupt').createInterrupter('staccato')

function Staccato (stream, opening) {
    this.stream = stream
    this._destructor = new Destructor(interrupt)
    this._listeners = {
        open: this._open.bind(this),
        error: this.destroy.bind(this)
    }
    this._janitors = {
        open: { object: this, method: '_open' },
        error: { object: this, method: '_uncatch' },
        destroyed: { object: this, method: '_destroyed' },
        delta: { object: this, method: '_cancel' },
    }
    this._destructor.addDestructor('mark', { object: this, method: '_destroyed' })
    this._delta = null
    this._readable = false
    if (opening) {
        this._destructor.addDestructor('open', this._janitors.open)
    } else {
        this._open()
    }
    this.stream.once('error', this._listeners.error)
    this._destructor.addDestructor('error', this._janitors.error)
    this.destroyed = false
}

Staccato.prototype._destroyed = function () {
    this.destroyed = true
}

Staccato.prototype._open = function () {
    this.stream.removeListener('open', this._listeners.open)
    this._opened = true
}

Staccato.prototype._uncatch = function () {
    this.stream.removeListener('error', this._listeners.error)
}

Staccato.prototype._cancel = function () {
    if (this._delta != null) {
        this._delta.cancel([])
        this._delta = null
    }
}

Staccato.prototype.destroy = function () {
    this._destructor.destroy()
}

Staccato.prototype.ready = cadence(function (async) {
    this._destructor.check()
    if (!this._opened) {
        async(function () {
            this._destructor.invokeDestructor('open')
            this._destructor.invokeDestructor('error')
            this._destructor.addDestructor('delta', this._janitors.delta)
            this._delta = delta(async()).ee(this.stream).on('open')
        }, function () {
            this._delta = null
            this._destructor.invokeDestructor('delta')
            this.stream.once('error', this._listeners.error)
            this._destructor.addDestructor('error', this._janitors.error)
        })
    }
})

module.exports = Staccato
