var stream = require('stream')
var cadence = require('cadence')
var delta = require('delta')
var Destructor = require('nascent.destructor')
var interrupt = require('interrupt').createInterrupter('staccato')

function Staccato (stream, opening) {
    this.stream = stream
    this._destructor = new Destructor(interrupt)
    this._destructor.addJanitor('mark', { object: this, method: '_destroyed' })
    this._delta = null
    this._readable = false
    // TODO Profile.
    this._listeners = {
        open: this._open.bind(this),
        error: this._destructor.destroy.bind(this._destructor)
    }
    if (opening) {
        this._destructor.addJanitor('open', { object: this, method: '_open' })
    } else {
        this._open()
    }
    this.stream.once('error', this._listeners.error)
    this._destructor.addJanitor('error', { object: this, method: '_uncatch' })
}

Staccato.prototype._destroyed = function () {
    this.destroyed = true
}

Staccato.prototype._open = function () {
    this.stream.removeListener('open', this._listeners.open)
    this._opened = true
}

Staccato.prototype._uncatch = function () {
    this.stream.removeListener('open', this._listeners.error)
}

Staccato.prototype.destroy = function () {
    this._destructor.destroy()
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
        async(function () {
            console.log('here')
            this._destructor.invokeJanitor('open')
            this._destructor.invokeJanitor('error')
            this._delta = delta(async()).ee(this.stream).on('open')
        }, function () {
            this._delta = null
            this.stream.once('error', this._catch)
            this._destructor.addJanitor('error', this, '_uncatch')
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

module.exports = Staccato
