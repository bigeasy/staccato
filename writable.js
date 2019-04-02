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
    Staccato.call(this, stream)
    this._once('finish', this._destroy.bind(this))
    this._once('close', this._destroy.bind(this))
}
util.inherits(Writable, Staccato)

// Write the given `buffer` to the stream waiting for the stream to drain if the
// buffer is not written successfully. Unlike the Node.js stream write, this
// write will return any error reported by the write stream.

//
Writable.prototype.write = cadence(function (async, buffer) {
    if (this.destroyed) {
        return false
    } else if (this.stream.write(buffer)) { // <- comes out the erorr handler if bad
        return ! this.destroyed
    } else if (this.destroyed) { // <- the above write might destroy
        return false
    } else {
        async(function () {
            this.state = 'draining'
            this._delta = delta(async()).ee(this.stream).on('drain')
        }, function () {
            this.state = 'idle'
            this._delta = null
            return ! this.destroyed
        })
    }
})

// Could have a `closed` property but if you cancel the `finish` with `destroy`
// it will not be set correctly. I'm not willing to leave a listener on the
// stream because destroy is supposed to remove itself from the stream.

// Wait for the underlying stream to finish.

// With writable streams you either get a finish or a close, maybe both but you
// can't count on one or the other before Node.js 10 and the `emitClose` flag.

//
Writable.prototype.end = cadence(function (async) {
    if (!this.destroyed) {
        async(function () {
            // We know that this will also repsond to close.
            this.state = 'finishing'
            this._delta = delta(async()).ee(this.stream).on('finish')
            this.stream.end()
        }, function () {
            this.state = 'idle'
            this._delta = null
        })
    }
})

module.exports = Writable
