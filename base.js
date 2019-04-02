function Staccato (stream) {
    this.stream = stream
    this._listeners = {}
    this._delta = null
    this.error = null
    this._once('error', this._catch.bind(this))
    this.destroyed = false
}

Staccato.CANCELLED = {}

Staccato.prototype._once = function (name, listener) {
    this._listeners[name] = listener
    this.stream.once(name, listener)
}

Staccato.prototype._catch = function (error) {
    this._destroy([ this.error = error ])
}

Staccato.prototype.destroy = function () {
    this._destroy()
}

Staccato.prototype._destroy = function (vargs) {
    if (!this.destroyed) {
        this.destroyed = true
        for (var name in this._listeners) {
            this.stream.removeListener(name, this._listeners[name])
        }
        if (this._delta) {
            this._delta.cancel([])
        }
    }
}

Staccato.prototype.raise = function () {
    if (this.error) {
        throw this.error
    }
}

module.exports = Staccato
