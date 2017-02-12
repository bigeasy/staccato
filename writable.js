var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var Staccato = require('./base')
var interrupt = require('interrupt').createInterrupter('staccato')

function Writable (stream, opening) {
    Staccato.call(this, stream, opening)
}
util.inherits(Writable, Staccato)

Writable.prototype.write = cadence(function (async, buffer) {
    this._destructor.check()
    if (!this.stream.write(buffer)) { // <- does this 'error' if `true`?
        async(function () {
            this._destructor.invokeDestructor('error')
            this._destructor.addDestructor('delta', this._janitors.error)
            this._delta = delta(async()).ee(this.stream).on('drain')
        }, function () {
            this._delta = null
            this._destructor.invokeDestructor('delta')
            this.stream.once('error', this._listeners.error)
            this._destructor.addDestructor('error', this._janitors.error)
        })
    }
})

Writable.prototype.close = cadence(function (async) {
    this._destructor.check()
    async(function () {
        this._destructor.invokeDestructor('error')
        this._destructor.addDestructor('delta', this._janitors.error)
        this._delta = delta(async()).ee(this.stream).on('finish')
        this.stream.end()
    }, function () {
        this._delta = null
        this._destructor.invokeDestructor('delta')
        this._destructor.destroy(interrupt('closed'))
    })
})

module.exports = Writable
