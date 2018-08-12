// Node.js API.
var stream = require('stream')
var util = require('util')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Exceptions you can catch by type.
var Interrupt = require('interrupt').createInterrupter('staccato')

// Return the first not null-like value.
var coalesce = require('extant')

// Common base class.
var Staccato = require('./base')


// Construct a new `Writable` that reads from the given `stream`.

//
function Writable (stream) {
    this.finished = false
    Staccato.call(this, stream)
}
util.inherits(Writable, Staccato)

// Write the given `buffer` to the stream waiting for the stream to drain if the
// buffer is not written successfully. Unlike the Node.js stream write, this
// write will return any error reported by the write stream.

//
Writable.prototype.write = cadence(function (async, buffer) {
    Interrupt.assert(!this.destroyed, 'destroyed', { cause: coalesce(this._error) })
    if (!this.stream.write(buffer)) { // <- does this 'error' if `true`?
        Interrupt.assert(!this.destroyed, 'destroyed', { cause: coalesce(this._error) })
        async(function () {
            this._delta = delta(async()).ee(this.stream).on('drain')
        }, function () {
            this._delta = null
        })
    }
})

// Could have a `closed` property but if you cancel the `finish` with `destroy`
// it will not be set correctly. I'm not willing to leave a listener on the
// stream because destroy is supposed to remove itself from the stream.

// Wait for the underlying stream to finish.

//
Writable.prototype.close = cadence(function (async) {
    Interrupt.assert(!this.destroyed, 'destroyed', { cause: coalesce(this._error) })
    async(function () {
        this._delta = delta(async()).ee(this.stream).on('finish')
        this.stream.end()
    }, function (cancelled) {
        this.finished = cancelled !== Staccato.CANCELLED
        this._delta = null
    })
})

module.exports = Writable
