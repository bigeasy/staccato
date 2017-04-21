var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var interrupt = require('interrupt').createInterrupter('staccato')
var Staccato = require('./base.js')

function Readable (stream, opening) {
    Staccato.call(this, stream, opening)
    this.stream.once('end', this._listeners.error)
    this._destructible.addDestructor('end', this, '_unend')
    this._readable = true
}
util.inherits(Readable, Staccato)

Readable.prototype._unend = function () {
    this.stream.removeListener('end', this._listeners.error)
}

Readable.prototype.read = cadence(function (async) {
    var waited = false
    var loop = async(function () {
        if (!this._readable) {
            waited = true
            console.log('waiting')
            this._delta = delta(async()).ee(this.stream).on('readable')
            this._destructible.addDestructor('delta', this, '_cancel')
        }
    }, function () {
        console.log('resuming', waited, this._readable, this.destroyed)
        if (!this._readable) {
            this._delta = null
            this._destructible.invokeDestructor('delta')
        }
        if (this.destroyed) {
            // TODO Unlike Writable, reading a closed Readable will always
            // return null no matter how often you call it.
            this._readable = true
            return [ loop.break, null ]
        }
        this._readable = true
        var object = this.stream.read()
        if (object == null) {
            if (waited) {
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
