const once = require('prospective/once')
const callback = require('prospective/callback')

class Writable {
    constructor (stream) {
        this.destroyed = false
        this._error = () => this._destroy()
        this._output = stream
        this._output.on('error', this._error)
    }

    _destroy () {
        this.destroyed = true
        this._output.removeListener('error', this._error)
    }

    async write (buffers) {
        if (this.destroyed) {
            return false
        }
        if (!Array.isArray(buffers)) {
            buffers = [ buffers ]
        }
        for (let buffer of buffers) {
            if (!this._output.write(buffer) && !this.destroyed) {
                await once(this._output, 'drain', null)
            }
        }
        return ! this.destroyed
    }

    async end () {
        if (!this.destroyed) {
            this._destroy()
            await callback(callback => this._output.end(callback))
        }
    }
}

module.exports = Writable
