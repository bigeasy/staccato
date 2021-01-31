const { Interrupt } = require('interrupt')
const Future = require('perhaps')
const once = require('eject')
const stream = require('stream')
const events = require('events')

class Staccato extends events.EventEmitter {
    static VERSION = +require('./package.json').version.split('.')[0]

    static Error = Interrupt.create('Staccato.Error', {
        WRITE_AFTER_FINISH: 'attempted to write after finish'
    })

    static async rescue (f) {
        try {
            return await (typeof f == 'function' ? f() : f)
        } catch (error) {
            if (error.symbol !== Staccato.Error.WRITE_AFTER_FINISH) {
                throw error
            }
        }
    }

    static Reader = class {
        constructor (staccato) {
            this.staccato = staccato
            this.ended = staccato._destroyed
            this._done = new Future
            this._readable = Future.resolve()
            this._onreadable = () => this._readable.resolve()
            this._unlisteners = [() => {
                this.ended = true
                this._done.resolve()
                this._readable.resolve()
            }]
            if (
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
            this.ended = true
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
        //

        // Unlisten.

        //
        _unlisten () {
            this._unlisteners.splice(0).forEach(f => f())
        }
        //

        // A cancelable drain that will return if the stream errors.

        //
        async drain () {
            if (! this.finished) {
                this._drain = once(this.staccato.stream, [ 'drain', 'staccato.finished' ], null)
                await this._drain.promise
            }
        }
        //

        // Internal synchronous write. If it returns a promise it means we need
        // to wait on the promise to drain.

        //
        _write (buffer) {
            if (! this.finished && this.staccato.stream.write(buffer)) {
                return null
            }
            if (this.finished) {
                throw new Staccato.Error('WRITE_AFTER_FINISH')
            }
            return this.drain()
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
        async write (buffers) {
            for (const buffer of buffers) {
                const promise = this._write(buffer)
                if (promise != null) {
                    await promise
                }
            }
        }
        //

        // That loop is going to be unpleasant to test.

        //
        async consume (iterator) {
            for await (const buffers of iterator) {
                for (const buffer of buffers) {
                    const promise = this._write(buffer)
                    if (promise != null) {
                        await promise
                    }
                }
            }
        }
        //

        // A callback given to `end()` is simply registered for the `'finish'`
        // or `'error'` event. On Node.js 12 the `'error'` event is not
        // registered, so behavior varies across the versions we support, so we
        // just call end if we haven't already ended.

        //
        end () {
            Staccato.Error.assert(! this.finished, 'WRITE_AFTER_FINISH')
            this.staccato.stream.end()
        }
    }
    //

    // You need to construct the Staccto the moment you get the stream.

    // **TODO** Assertions that the stream is not finished, ended, closed or
    // destroyed.

    //
    constructor (stream) {
        super()
        this.stream = stream
        this._readable = null
        this._writable = null
        this._listening = []
        this.stream.once('error', this._onerror = error => {
            this._destroyed = true
            this.unlisten()
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

    done () {
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

    unlisten () {
        this._listening.splice(0).forEach(listener => listener._unlisten())
        this.stream.removeListener('error', this._onerror)
    }
}

exports.Staccato = Staccato
