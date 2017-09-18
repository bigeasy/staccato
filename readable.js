var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var interrupt = require('interrupt').createInterrupter('staccato')
var Staccato = require('./base.js')

function Readable (stream, opening) {
    Staccato.call(this, stream, opening)
    this._ended = false
    this.stream.once('end', function () {
        this._ended = true
        this._cancel()
    }.bind(this))
    this._destructible.addDestructor('end', this, '_unend')
    this._destructible.addDestructor('delta', this, '_cancel')
    this._readable = true
}
util.inherits(Readable, Staccato)

Readable.prototype._unend = function () {
    this.stream.removeListener('end', this._listeners.error)
}

Readable.prototype.read = cadence(function (async, count) {
    var loop = async(function () {
        if (!this._readable) {
            this._delta = delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        if (!this._readable) {
            this._cancel()
        }
        if (this.destroyed) {
            // TODO Maybe we raise an exception if there is an error using
            // an Interrupt based assert.
            // TODO Unlike Writable, reading a closed Readable will always
            // return null no matter how often you call it.
            this._readable = true
            return [ loop.break, null ]
        }
        this._readable = true
        var object = count == null ? this.stream.read() : this.stream.read(count)
        if (object == null) {
            if (this._ended) {
                this.destroy()
                return [ loop.break, null ]
            } else {
                this._readable = false
            }
        } else {
            return [ loop.break, object ]
        }
    })()
})

module.exports = Readable
