// Node.js API.
var stream = require('stream')
var util = require('util')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Exceptions you can catch by type.
var interrupt = require('interrupt').createInterrupter('staccato')

// Return the first not null-like value.
var coalesce = require('extant')

// Common base class.
var Staccato = require('./base')


// Construct a new `Writable` that reads from the given `stream`. If `opening`
// is true, the `ready` method will wait until the stream is open.

//
function Writable (stream, opening) {
    Staccato.call(this, stream, opening)
}
util.inherits(Writable, Staccato)

// Write the given `buffer` to the stream waiting for the stream to drain if the
// buffer is not written successfully. Unlike the Node.js stream write, this
// write will return any error reported by the write stream.

//
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

// Wait for the underlying stream to finish.

//
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
