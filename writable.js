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
    interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._error))
    if (!this.stream.write(buffer)) { // <- does this 'error' if `true`?
        interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._error))
        async(function () {
            this._delta = delta(async()).ee(this.stream).on('drain')
        }, function () {
            this._delta = null
        })
    }
})

Writable.prototype.close = cadence(function (async) {
    interrupt.assert(!this.destroyed, 'destroyed', coalesce(this._error))
    async(function () {
        this._delta = delta(async()).ee(this.stream).on('finish')
        this.stream.end()
    }, function () {
        this._delta = null
    })
})

module.exports = Writable
