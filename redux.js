const Interrupt = require('interrupt')
const callback = require('prospective/callback')
const once = require('prospective/once')
const stream = require('stream')
const events = require('events')

const VERSION = + require('./package.json').version.split('.')[0]

class Staccato extends events.EventEmitter {
    static Error = Interrupt.create('Staccato.Error', {
        IO_ERROR: 'errors occurred in the underlying stream'
    })

    constructor (...vargs) {
        super()
        this._trace = typeof vargs[0] == 'function' ? vargs.shift() : null
        this.stream = vargs.shift()
        this._properties = vargs.shift() || {}
        this._vargs = vargs
        const cleanup = stream.finished(this.stream, () => {
            cleanup()
            this.finished = true
            this.ended = true
            this._readable.resolve('staccato.canceled')
            this._drain.resolve('staccato.canceled')
        })
        this.stream.on('error', error => {
            this._errors.push(error)
            if (this.destroyed) {
                process.emit('staccato.error', this._error(), VERSION)
            }
        })
        this.finished = false
        this.ended = false
        this.destroyed = false
        this._errors = []
        this._readable = once.NULL
        this._drain = once.NULL
    }

    raise () {
        if (this._errors.length != 0) {
            throw this._error()
        }
    }

    close () {
        this.stream.destroy()
        this.destroyed = true
        if (this._errors.length != 0) {
            throw this._error()
        }
    }

    errors () {
        return this._errors.splice(0)
    }

    _error () {
        return new Staccato.Error('IO_ERROR', this._errors.splice(0), {
            $trace: this._trace, $callee: this._error
        }, this._properties)
    }

    async write (buffer) {
        if (!this.finished && !this.stream.write(buffer) && !this.finished) {
            console.log('draining')
            this._drain = once(this.stream, [ 'drain', 'staccato.canceled' ], null)
            await this._drain.promise
        }
        return ! this.finished
    }

    async end () {
        if (!this.finished) {
            await callback(callback => this.stream.end(callback))
        }
    }

    async read (count) {
        if (this.ended) {
            return null
        }
        this._readable = once(this.stream, [ 'readable', 'staccato.canceled' ], null)
        await this._readable.promise
        if (this.ended) {
            return null
        }
        const object = count == null ? this.stream.read() : this.stream.read(count)
        this.ended = object == null
        return object
    }

    async *[Symbol.asyncIterator] () {
        for (;;) {
            const value = await this.read()
            if (value == null) {
                break
            }
            yield value
        }
    }
}

module.exports = Staccato
