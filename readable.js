var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var interrupt = require('interrupt').createInterrupter('staccato')
var Staccato = require('./base.js')

function Readable (stream, opening) {
    Staccato.call(this, stream, opening)
    this._listeners.end = this._end.bind(this)
    this.stream.once('end', this._listeners.end)
    this._readable = true
}
util.inherits(Readable, Staccato)

Readable.prototype.destroy = function () {
    this.stream.removeListener('end', this._listeners.end)
    Staccato.prototype.destroy.call(this)
}

Readable.prototype._end = function () {
    this._destroy([])
}

Readable.prototype.read = cadence(function (async, count) {
    var loop = async(function () {
        if (!this._readable) {
            this._delta = delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        this._delta = null

        this._readable = true

        if (this.destroyed) {
            if (this._error != null) {
                throw error
            }

            // Unlike Writable, reading a closed Readable will always return
            // null no matter how often you call it.
            return [ loop.break, null ]
        }

        var object = count == null ? this.stream.read() : this.stream.read(count)
        if (object == null) {
            this._readable = false
        } else {
            return [ loop.break, object ]
        }
    })()
})

module.exports = Readable
