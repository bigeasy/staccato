var stream = require('stream')
var util = require('util')
var cadence = require('cadence')
var delta = require('delta')
var Destructor = require('nascent.destructor')
var interrupt = require('interrupt').createInterrupter('staccato')
var Staccato = require('./staccato.base.js')

function Readable (stream, opening) {
    Staccato.call(this, stream, opening)
    this._catcher = function (error) { this._error = error }.bind(this)
    this._delta = null
    this._end = this._streamEnd.bind(this)
    this.stream.once('end', this._end)
    this._readable = false
    if (opening) {
        this.stream.once('open', this._onceOpen = function () {
            this._onceOpen = null
        }.bind(this))
    }
    this.stream.once('error', this._catcher)
    this._destructor = new Destructor(interrupt)
}
util.inherits(Readable, Staccato)

Readable.prototype._streamEnd = function () {
    this.destroy()
}

Readable.prototype.read = cadence(function (async) {
    var waited = false
    var loop = async(function () {
        if (!this._readable) {
            waited = true
            this._delta = delta(async()).ee(this.stream).on('readable')
        }
    }, function () {
        this._delta = null
        if (this.destroyed) {
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
