const once = require('prospective/once')
const callback = require('prospective/callback')

class Writable {
    constructor (stream) {
        this.destroyed = false
        this._error = () => this.destroy()
        this._output = stream
        this._output.on('error', this._error)
        this._drain = once.NULL
    }

    destroy () {
        this.destroyed = true
        this._output.removeListener('error', this._error)
        this._drain.resolve('drain', null)
    }

    async write (buffers) {
        if (this.destroyed) {
            return false
        }
        if (!Array.isArray(buffers)) {
            buffers = [ buffers ]
        }
        for (let buffer of buffers) {
            if (!this.destroyed && !this._output.write(buffer) && !this.destroyed) {
                await (this._drain = once(this._output, 'drain', null)).promise
            }
        }
        return ! this.destroyed
    }

    async end () {
        if (!this.destroyed) {
            this.destroy()
            await callback(callback => this._output.end(callback))
        }
    }
}

module.exports = Writable
