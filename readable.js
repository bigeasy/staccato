const once = require('prospective/once')
const LISTENERS = [ 'readable', 'end', 'close' ]

class Readable {
    constructor (stream) {
        this.destroyed = false
        this._destroyed = () => this.destroy()
        this._stream = stream
        this._stream.on('error', this._destroyed)
        this._stream.on('close', this._destroyed)
        this._stream.on('end', this._destroyed)
        this._readable = true
        this._waiting = once.NULL
    }

    destroy () {
        this.destroyed = true
        this._stream.removeListener('error', this._destroyed)
        this._stream.removeListener('close', this._destroyed)
        this._stream.removeListener('end', this._destroyed)
        this._waiting.resolve('close', null)
    }

    async read (count) {
        for (;;) {
            if (this.destroyed) {
                return null
            }
            if (!this._readable) {
                await (this._waiting = once(this._stream, [
                    'readable', 'end', 'close'
                ], null)).promise
            }
            if (this.destroyed) {
                return null
            }
            const object = count == null ? this._stream.read() : this._stream.read(count)
            if (object != null) {
                return object
            }
            this._readable = false
        }
    }

    [Symbol.asyncIterator]() {
        return {
            next: async () => {
                const value = await this.read()
                if (value == null) {
                    return { done: true }
                }
                return { done: false, value }
            },
            return: () => {
                this.destroy()
                return { done: true }
            }
        }
    }
}

module.exports = Readable
