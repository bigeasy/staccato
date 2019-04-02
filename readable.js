// Node.js API.
var stream = require('stream')
var util = require('util')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Common base class.
var Staccato = require('./base.js')

// Note that we treat destroy will give you the same response as an end of file,
// a `null`, so use `Readable` and react to destroy just as if you'd encountered
// a truncated file. If you can't handle a truncated file then don't use
// `Readable`.

// Construct a new `Readable` that reads from the given `stream`.

//
function Readable (stream) {
    Staccato.call(this, stream)
    this._once('end', this._destroy.bind(this))
    this._once('close', this._destroy.bind(this))
    this._readable = true
    this.error = null
}
util.inherits(Readable, Staccato)

// The `end` event will issued until `end` is called and all the data has been
// read from the stream. Calling destroy here will not cause any sort of
// truncation doing so explicitly cancels our wait on the `readable` event.
//
// Basically, we know that during normal operation, after we've reached the end
// of stream our `read` method is going to get that last `readable` that says
// that the buffer has drained and then loop back around and wait on `readable`
// again, blocking indefinitely unless we cancel its wait via Delta.

//
/* Readable.prototype._end = function () {
    this._destroy([])
} */

// Read from the stream specifying an optional block count. If the block count
// is `null` then `read` will return the result of the next call to the
// underlying `stream.read`. If `count` is not null then `read` will return the
// `count` bytes or the remainder of the stream if the stream has ended and
// there are not enough bytes remaining the fulfill the `count`.
//
// When the stream has needed or the `Readable.destroy` method is called `read`
// will call `null`. Reading the end of the stream destroys the `Readable`.
// Calling `read` after the `Readable` has been destroyed always returns `null`.

//
Readable.prototype.read = cadence(function (async, count) {
    async.loop([], function () {
        if (!this._readable) {
            this.state = 'reading'
            this._delta = delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        this.state = 'idle'
        this._delta = null

        this._readable = true

        if (this.destroyed) {
            // Unlike Writable, reading a closed Readable will always return
            // null no matter how often you call it.
            return [ async.break, null ]
        }

        var object = count == null ? this.stream.read() : this.stream.read(count)
        if (object == null) {
            this._readable = false
        } else {
            return [ async.break, object ]
        }
    })
})

module.exports = Readable
