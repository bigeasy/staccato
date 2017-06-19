var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var Staccato = require('./base')
var interrupt = require('interrupt').createInterrupter('staccato')
var coalesce = require('extant')

function Writable (stream, opening) {
    Staccato.call(this, stream, opening)
}
util.inherits(Writable, Staccato)

Writable.prototype.write = cadence(function (async, buffer) {
    interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._destructible.errors[0]))
    if (!this.stream.write(buffer)) { // <- does this 'error' if `true`?
        interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._destructible.errors[0]))
        async(function () {
            this._destructible.invokeDestructor('error')
            this._destructible.addDestructor('delta', this, '_cancel')
            this._delta = delta(async()).ee(this.stream).on('drain')
        }, function () {
            this._delta = null
            this._destructible.invokeDestructor('delta')
            this.stream.once('error', this._listeners.error)
            this._destructible.addDestructor('error', this, '_uncatch')
        })
    }
})

Writable.prototype.close = cadence(function (async) {
    interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._destructible.errors[0]))
    async(function () {
        this._destructible.invokeDestructor('error')
        this._destructible.addDestructor('delta', this, '_cancel')
        this._delta = delta(async()).ee(this.stream).on('finish')
        this.stream.end()
    }, function () {
        this._delta = null
        this._destructible.invokeDestructor('delta')
        this._destructible.destroy(interrupt('closed'))
    })
})

module.exports = Writable
