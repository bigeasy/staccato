const Interrupt = require('interrupt')
const callback = require('comeuppance')
const once = require('eject')
const stream = require('stream')
const events = require('events')

const VERSION = + require('./package.json').version.split('.')[0]

class Staccato extends events.EventEmitter {
    static Error = Interrupt.create('Staccato.Error', {
        IO_ERROR: 'errors occurred in the underlying stream'
    })
    //

    // You need to construct the Staccto the moment you get the stream.

    // **TODO** Assertions that the stream is not finished, ended, closed or
    // destroyed.

    //
    constructor (...vargs) {
        super()
        this._trace = typeof vargs[0] == 'function' ? vargs.shift() : null
        this.stream = vargs.shift()
        this._properties = vargs.shift() || {}
        this._vargs = vargs
        this._cleanup = stream.finished(this.stream, () => {
            (this._cleanup)()
            console.log('here!!!')
            this.finished = true
            this.ended = true
            this._readable.resolve('staccato.canceled')
            this._drain.resolve('staccato.canceled')
        })
        this.stream.on('error', this._onerror = error => {
            console.log('here!!!')
            this._errors.push(error)
            if (this.closed) {
                process.emit('staccato.error', this._error(), VERSION)
            }
        })
        this.stream.on('finish', () => this.finished = true)
        this.finished = false
        this.ended = false
        this.stream.on('end', () => this.ended = true)
        this.closed = false
        this._errors = []
        this._readable = once.NULL
        this._drain = once.NULL
    }

    raise () {
        if (this._errors.length != 0) {
            throw this._error()
        }
    }
    //


    //
    close () {
        if (this.closed != true) {
            this.closed = true
        }
        if (this._errors.length != 0) {
            throw this._error()
        }
    }

    unlisten () {
        this.closed = true
        if (this._cleanup != null) {
            (this._cleanup)()
        }
        if (this._onerror != null) {
            this.stream.removeListener('error', this._onerror)
            this._onerror = null
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

    write (buffer) {
        if (!this.finished && !this.stream.write(buffer) && !this.finished) {
            this._drain = once(this.stream, [ 'drain', 'staccato.canceled' ], null)
            return (async () => {
                this._drain.promise
                return ! this.finished
            }) ()
        }
        return this.finished ? Promise.resolve(false) : null
    }
    //

    // A callback given to `end()` is simply registered for the `'finish'` or
    // `'error'` event. On Node.js 12 the `'error'` event is not registered, so
    // behavior varies across the versions we support, so we just call end if we
    // haven't already ended.

    //
    end () {
        if (!this.finished) {
            this.stream.end()
        }
    }

    async read (count) {
        for (;;) {
            if (this.stream.readableLength != 0) {
                return count == null ? this.stream.read() : this.stream.read(count)
            }
            if (this.ended) {
                return null
            }
            this._readable = once(this.stream, [ 'readable', 'staccato.canceled' ], null)
            await this._readable.promise
        }
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
