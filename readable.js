const noop = require('nop')
const LISTENERS = [ 'readable', 'end', 'close', 'error' ]

class Readable {
    constructor (stream) {
        this.destroyed = false
        this._destroyed = () => this.destroy()
        this._stream = stream
        this._stream.on('error', this._destroyed)
        this._stream.on('close', this._destroyed)
        this._stream.on('end', this._destroyed)
        this._resolve = noop
        this._readable = true
    }

    destroy () {
        this.destroyed = true
        this._stream.removeListener('error', this._destroyed)
        this._stream.removeListener('close', this._destroyed)
        this._stream.removeListener('end', this._destroyed)
        this._resolve.call()
    }

    async read (count) {
        for (;;) {
            if (this.destroyed) {
                return null
            }
            if (!this._readable) {
                await new Promise(resolve => {
                    this._resolve = () => {
                        for (const listener of LISTENERS) {
                            this._stream.removeListener(listener, this._resolve)
                        }
                        this._resolve = noop
                        resolve()
                    }
                    for (const listener of LISTENERS) {
                        this._stream.on(listener, this._resolve)
                    }
                })
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
