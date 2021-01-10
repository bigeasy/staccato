const Interrupt = require('interrupt')
const Future = require('perhaps')
const once = require('eject')
const stream = require('stream')
const events = require('events')

const VERSION = + require('./package.json').version.split('.')[0]

class Staccato extends events.EventEmitter {
    static Reader = class {
        constructor (staccato) {
            this.staccato = staccato
            this.ended = false
            this._done = new Future
            this._readable = Future.resolve()
            this._onreadable = () => this._readable.resolve()
            this._unlisteners = [() => {
                this.ended = true
                this._done.resolve()
                this._readable.resolve()
            }]
            if (
                this.staccato.departed ||
                this.staccato.errored ||
                ! this.staccato.stream.readable ||
                this.staccato.stream.destroyed
            ) {
                this._unlisten()
            } else {
                this.staccato.stream.on('readable', this._onreadable)
                this._unlisteners.push(() => this.staccato.stream.removeListener('readable', this._onreadable))
                this._unlisteners.push(stream.finished(this.staccato.stream, {
                    error: false, writable: false
                }, () => this._unlisten()))
            }
        }

        get done () {
            if (! this._done.fulfilled) {
                return this._done.promise
            }
            return null
        }

        _unlisten () {
            this._unlisteners.splice(0).forEach(f => f())
        }

        async read (bytes = null) {
            for (;;) {
                if (this.ended) {
                    return null
                }
                const chunk = bytes == null ? this.staccato.stream.read() : this.staccato.stream.read(bytes)
                if (chunk != null) {
                    return chunk
                }
                this._readable = new Future
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

    static Writer = class {
        constructor (staccato) {
            this.staccato = staccato
            this.finished = false
            this._done = new Future
            this._drain = once.NULL
            this._unlisteners = [() => {
                this.finished = true
                this._done.resolve()
                this._drain.emit('staccato.finished')
            }]
            if (
                this.staccato.departed ||
                this.staccato.errored ||
                ! this.staccato.stream.writable ||
                this.staccato.stream.destroyed
            ) {
                this._unlisten()
            } else {
                this._unlisteners.push(stream.finished(this.staccato.stream, {
                    error: false, readable: false
                }, () => this._unlisten()))
            }
        }

        get done () {
            if (! this._done.fulfilled) {
                return this._done.promise
            }
            return null
        }

        _unlisten () {
            this._unlisteners.splice(0).forEach(f => f())
        }

        async drain () {
            if (! this.finished) {
                this._drain = once(this.staccato.stream, [ 'drain', 'staccato.finished' ], null)
                await this._drain.promise
            }
        }
        //

        // We could return `true` when we write to a finished stream, which
        // may seem like a deception, but a successful write on a Node.js only
        // indicates that the entry was buffered, or that the stream was
        // destroyed, but that is barely documented. We're going to return
        // `false` which will lead the caller to a benign `drain`, then to a
        // check of `finished`, this is no more or less confusing than the
        // Node.js streams API.

        //
        write (buffer) {
            if (this.finished) {
                return true
            }
            return this.staccato.stream.write(buffer)
        }
        //

        // That loop is going to be unpleasant to test.

        //
        async _async (iterator, end) {
            try {
                for await (const write of iterator) {
                    const writes = Array.isArray(write) ? write : [ write ]
                    for (const write of writes) {
                        if (this.finished) {
                            break
                        }
                        if (! this.write(write)) {
                            await this.drain()
                        }
                    }
                }
            } finally {
                if (end) {
                    this.end()
                }
            }
        }
        //

        //
        async _sync (iterator, end) {
            try {
                for (const write of iterator) {
                    const writes = Array.isArray(write) ? write : [ write ]
                    for (const write of writes) {
                        if (this.finished) {
                            break
                        }
                        if (! this.write(write)) {
                            await this.drain()
                        }
                    }
                }
            } finally {
                if (end) {
                    this.end()
                }
            }
        }
        //
        consume (iterator, end = false) {
            if (iterator[Symbol.asyncIterator]) {
                return this._async(iterator, end)
            }
            return this._sync(iterator, end)
        }
        //

        // A callback given to `end()` is simply registered for the `'finish'`
        // or `'error'` event. On Node.js 12 the `'error'` event is not
        // registered, so behavior varies across the versions we support, so we
        // just call end if we haven't already ended.

        //
        end () {
            if (! this.finished) {
                this.staccato.stream.end()
            }
        }
    }

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
        this.departed = false
        this._readable = null
        this._writable = null
        this._errors = []
        this.errored = false
        this._listening = []
        this.listening = true
        this.stream.on('error', this._onerror = error => {
            this.errored = true
            this._unlisten()
            this._errors.push(error)
            if (this.departed) {
                process.emit('staccato.error', this._error(), VERSION)
            }
        })
    }

    get readable () {
        if (this._readable != null) {
            return this._readable
        }
        this._listening.push(this._readable = new Staccato.Reader(this))
        return this._readable
    }

    get writable () {
        if (this._writable != null) {
            return this._writable
        }
        this._listening.push(this._writable = new Staccato.Writer(this))
        return this._writable
    }

    get done () {
        const dones = [
            this._readable, this._writable
        ].filter(able => able)
         .map(able => able.done)
         .filter(done => done)
        if (dones.length != 0) {
            return Promise.all(dones)
        }
        return null
    }

    _unlisten () {
        this._listening.splice(0).forEach(listener => listener._unlisten())
    }

    unlisten () {
        if (this.listening) {
            this.listening = false
            this._unlisten()
            this.stream.removeListener('error', this._onerror)
            this._onerror = null
        }
    }

    errors () {
        return this._errors.splice(0)
    }

    _error ($callee) {
        return new Staccato.Error('IO_ERROR', this._errors.splice(0), {
            $trace: this._trace, $callee: $callee
        }, this._properties)
    }

    _raise ($callee) {
        if (this._errors.length != 0) {
            throw this._error($callee)
        }
    }

    raise () {
        this._raise(this.raise)
    }

    depart () {
        this.departed = true
        this._raise(this.depart)
    }
}

module.exports = Staccato
