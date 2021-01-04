// Staccato began life an an error-first callback adaptor to Node.js streams. It
// has evolved into an `async`/`await` interface that I've used while the
// Node.js streams API transitioned to its own `async`/`await` support. It is
// still valuable to me for the handling of errors, specifically for duplex
// streams where the new Node.js async iterator interface will raise an
// exception while the writer side still needs to do `'error'` listeners.

//
require('proof')(27, async okay => {
    const stream = require('stream')
    const callback = require('comeuppance')
    const once = require('eject')
    const Staccato = require('../redux')
    const path = require('path')
    const fs = require('fs').promises
    const fileSystem = require('fs')
    //

    // We are going to read and write some files, so we create a temporary
    // directory.

    //
    const tmp = path.resolve(__dirname, 'tmp')
    await fs.rmdir(tmp, { recursive: true })
    await fs.mkdir(tmp, { recursive: true })
    //

    // Staccato believes that streams just truncate sometimes. This is not an
    // error that will be reported by the transport. The sender could just close
    // the socket or a file might not have been flushed before someone tripped
    // over the power cord. There's always an application requirement to
    // validate the the data that came from the outside.

    // To read from the stream you use `staccato.readable`. When you reference
    // `staccato.readable`, Staccato begins to treat the underlying stream as a
    // `Readable` stream. If you never reference it, staccato will ingnore it.

    // With that in mind async iterator just stops sending blocks on error. To
    // find the error you call `raise()`. If there any errors `raise()` will
    // thrown an aggregate exception with the errors in a nested `errors`
    // property.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.write('a')
        through.write('b')
        through.write('c')
        through.end()

        const gathered = []
        for await (const block of staccato.readable) {
            gathered.push(block)
        }

        staccato.depart()

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }
    //

    // You can use `read` from `staccato.readable` and you can pass it a `size`
    // which will await for `size` bytes before returning unless the stream has
    // ended and less than `size` bytes are all that is left.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.write('abc')
        through.end()

        const gathered = []
        for (;;) {
            const block = await staccato.readable.read(1)
            if (block == null) {
                break
            }
            gathered.push(block)
        }

        staccato.raise()

        okay(gathered.length, 3, 'byte at a time')
        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }
    //

    // We can see what happens when Staccato encounters an error.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.emit('error', new Error('error'))

        try {
            const gathered = []
            for (;;) {
                console.log('await')
                const block = await staccato.readable.read(1)
                console.log('awaited')
                if (block == null) {
                    break
                }
                gathered.push(block)
            }

            staccato.depart()
        } catch (error) {
            console.log(`\n${error.stack}\n`)
            okay(error.errors[0].message, 'error', 'raised error at close')
        }
    }
    //

    // You could also try to raise errors as you read.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.write('ab')
        through.end()

        try {
            const gathered = []
            for (;;) {
                const block = await staccato.readable.read(1)
                staccato.raise()
                if (block == null) {
                    break
                }
                gathered.push(block)
                through.emit('error', new Error('error'))
            }
            staccato.depart()
        } catch (error) {
            console.log(`\n${error.stack}\n`)
            okay(error.errors[0].message, 'error', 'raised error while reading')
        }
    }
    //

    // When you write you have drain if write returns `true`, just as in the
    // Node.js Stream API. Unlike the Node.js Stream API your drain will not
    // hang forever if there is an error. It will return immediately.

    // To keep from looping forever on this condition, you should check the
    // `finished` property of `staccato.writable` before reading. If the stream
    // is finished `staccato.write()` will always return true and `drain()` is a
    // no-op.

    // Here we leave our write loop early because of an error.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        try {
            for (const letter of [ 'a', 'b', 'c' ]) {
                if (staccato.writable.finished) {
                    break
                }
                if (!staccato.writable.write(letter)) {
                    await staccato.writable.drain()
                }
                through.emit('error', new Error('error'))
            }
            staccato.writable.end()
            staccato.depart()
        } catch (error) {
            console.log(`\n${error.stack}\n`)
            okay(error.errors[0].message, 'error', 'raised error at close')
        }
    }
    //

    // That was convoluted example.

    // Here is a cleaner example of normal operation.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        for (const letter of [ 'a', 'b', 'c' ]) {
            if (staccato.writable.finished) {
                break
            }
            if (!staccato.writable.write(letter)) {
                await staccato.writable.drain()
            }
        }
        staccato.writable.end()
        staccato.depart()

        okay(through.read().toString(), 'abc', 'wrote')
    }
    //

    // Staccato will handle drain correctly.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)

        const promise = async function () {
            for (const string of [ 'abc', 'def' ]) {
                if (staccato.writable.finished) {
                    break
                }
                if (! staccato.writable.write(string)) {
                    await staccato.writable.drain()
                }
            }
            staccato.writable.end()
            staccato.depart()
        } ()

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await once(through, 'end').promise
        await promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered')
    }
    //

    // That write loop looks crufty but it contains the conditions of underlying
    // Node.js Stream API `write()`. If you're not doing it that way in your
    // streams code you've got a forever drain in your future.

    // We could have wrapped it the `drain()` in an `async` version of `write()`
    // but the the write loop is synchronous if there is no `drain` and that is
    // probably good for performance.

    // We have wrapped up the loop though. You can call it with an iterator and
    // it will consume the iterator writing it the stream in a single `async`
    // call.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await staccato.writable.consume(function* () {
            for (const string of [ 'abc', 'def' ]) {
                yield string
            }
        } ())
        staccato.writable.end()

        staccato.depart()

        await once(through, 'end').promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered')
    }
    //

    // Of course an array is iterable, so you can pass that into `consume` as
    // well and run a number of writes through the single `async` call.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await staccato.writable.consume([ 'abc', 'def' ])
        staccato.writable.end()

        staccato.depart()

        await once(through, 'end').promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered')
    }
    //

    // The iterator can be synchronous or asynchronous.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await staccato.writable.consume(async function* () {
            for (const string of [ 'abc', 'def' ]) {
                yield string
            }
        } ())
        console.log('here')
        staccato.writable.end()

        staccato.depart()

        await once(through, 'end').promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered')
    }
    //

    // If you to get as much work into a single synchornous pass through the
    // write loop, your asynchronous iterator can return an array of buffers.
    // This works for synchronous iterators too.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await staccato.writable.consume(async function* () {
            yield [ 'abc', 'def' ]
        } ())
        staccato.writable.end()

        staccato.depart()

        await once(through, 'end').promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered consume of async array of buffers')
    }
    //

    // If you pass a boolean as a second argument to consume, the writer will
    // close the stream after consuming the iterator.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)

        const gathered = []
        through.on('readable', () => {
            for (;;) {
                const block = through.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await staccato.writable.consume(function* () {
            for (const string of [ 'abc', 'def' ]) {
                yield [ string ]
            }
        } (), true)

        staccato.depart()

        await once(through, 'end').promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'auto end on consume')
    }
    //
    //

    // Wait a minute, if a Staccato writable consumes asynchronous iterators and
    // and a Staccato readable is an asynchronous iterator and consume closes streams
    // when they end iterator does that mean we can...

    //
    {
        const { createGzip, createGunzip } = require('zlib')

        const gzip = createGzip()
        const gunzip = createGunzip()

        const pipeline = [
            new Staccato(new stream.PassThrough),
            new Staccato(gzip),
            new Staccato(gunzip),
            new Staccato(new stream.PassThrough)
        ]

        pipeline.reduce((previous, next) => {
            next.writable.consume(previous.readable, true)
            return next
        })

        pipeline[0].stream.write('abcdef')
        pipeline[0].stream.end()

        const string = await pipeline[pipeline.length - 1].readable.read(6)

        pipeline.forEach(staccato => staccato.depart())

        okay(String(string), 'abcdef', 'piped through gzip and gunzip')
    }
    //

    // But, no. That's probably a bad idea.

    // Sometimes you might want to raise your own errors and include any
    // Staccato errors in an aggegrate error. The `errors()` method will return
    // an array containing the errors caught by Staccato. If there are no errors
    // the array is empty.

    // After you've called `errors()`, so long as no new errors arrive `close()`
    // will not raise an exception. You can ensure that no errors arrive by
    // calling `close()` synchronously before the next tick.

    //
    {
        const through = new stream.PassThrough({ highWaterMark: 2, emitClose: false })
        const staccato = new Staccato(through)
        okay(staccato.errors(), [], 'no errors')
        through.emit('error', new Error('error'))
        try {
            try {
                throw new Error('error')
            } catch (error) {
                const aggregate = new Error('aggregate')
                const errors = staccato.errors()
                errors.push(error)
                aggregate.errors = errors
                throw aggregate
            } finally {
                staccato.depart()
            }
        } catch (error) {
            okay(error.errors.length, 2, 'both errors in aggregate')
        }
    }
    //

    // Actually, let's go back to that bad idea. We can use `errors()` to gather
    // all the errors from our pseudo-pipeline into one aggregate error.

    //
    {
        const { createGzip, createGunzip } = require('zlib')

        try {
            const gzip = createGzip()
            const gunzip = createGunzip()

            const pipeline = [
                new Staccato(new stream.PassThrough),
                new Staccato(gzip),
                new Staccato(gunzip),
                new Staccato(new stream.PassThrough)
            ]

            pipeline.reduce((previous, next) => {
                next.writable.consume(previous.readable, true)
                return next
            })

            pipeline[0].stream.write('abcdef')
            pipeline[0].stream.emit('error', new Error('nope'))
            pipeline[0].stream.end()

            const string = await pipeline[pipeline.length - 1].readable.read(6)

            const errors = pipeline.map(staccato => staccato.errors()).flat()

            if (errors.length != 0) {
                const error = new Error('aggregate')
                error.errors = errors
                throw error
            }
        } catch (error) {
            okay(error.errors.length, 1, 'fished an error out a pipeline')
        }
    }
    //

    // Still don't recommend it.

    //

    // Staccato leaves a dangling error handler so when errors arrive after you
    // call `close()` they will not cause an `'uncaughtException'` to be raised.

    // After you call `close()`, if an error is emitted it will be emitted on
    // the `process` object as a `"staccato.error"` event.

    // The `"staccato.error"` event will receive each Staccato.Error as the
    // first argument and the major version of Staccato that emitted the event
    // as the last argument in case the interface changes. I promise to do a
    // major version bump if it does.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato($ => $(), through)

        process.once('staccato.error', (error, version) => {
            okay(error instanceof Staccato.Error, 'staccato error emitted')
            okay(error.errors[0].message, 'raised', 'raised error is nested')
            okay(version, 12, 'version as second argument')
        })

        through.write('abc')
        through.end()

        const gathered = []
        for await (const block of staccato.readable) {
            gathered.push(block)
        }
        staccato.depart()

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')

        through.emit('error', new Error('raised'))
    }
    //

    // These errors can be mysterious and hard to trace. Staccto uses two
    // features from Interrupt to help in tracing all Stacato.Error exceptions
    // whether they are thrown or caught by the dangling error listener.

    // The first argument to the Staccato constructor can be a trace function.
    // The argument after the stream can be a set of additional properties to
    // apply to the `Staccato.Error`.

    // When you run this unit test you will see the line where the Staccato was
    // constructed in the stack trace along with the additional properties.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato($ => $(), through, { file: 'abc.txt' })

        process.once('staccato.error', error => {
            okay(error instanceof Staccato.Error, 'staccato error emitted')
            console.log(error.stack)
        })

        through.write('abc')
        through.end()

        const gathered = []
        for await (const block of staccato.readable) {
            gathered.push(block)
        }
        staccato.depart()

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')

        through.emit('error', new Error('raised'))
    }

    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        staccato.readable
        staccato.writable

        const promise = staccato.done

        through.end()

        await promise

        okay(staccato.done, null, 'already done')
    }
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)
        staccato.unlisten()
        staccato.unlisten()
    }
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)
        through.destroy()
        await new Promise(resolve => setImmediate(resolve))
        okay(staccato.readable.ended, 'ended when crated')
        okay(staccato.writable.finished, 'finished when crated')
    }
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        const promise = async function () {
            return [ String(await staccato.readable.read(1)), String(await staccato.readable.read(1)) ]
        } ()

        through.write('abcdef')
        through.end()

        okay(await promise, [ 'a', 'b' ], 'await read')
    }
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)
        staccato.writable.end()
        staccato.writable.write('a')
        await staccato.writable.drain()
        await staccato.writable.consume([ 'a' ])
        await staccato.writable.consume(async function* () {
            yield 'a'
        } ())
    }
    return
    {
        const destructible = new Destructible('server')

        const socket = destructible.ephemeral($ => $(), 'socket')

        staccato.once('close', () => queue.push(null))

        socket.countdown($ => $(), 'errors', 3).destruct(() => staccto.errors())
        socket.durable($ => $(), 'read', async () => {
            for await (const block of staccto) {
                const drain = staccto.write(block)
                if (drain != null) {
                    await drain
                }
            }
        })
        socket.durable($ => $(), 'write', async () => {
            for await (const entry of shifter) {
                if (! await staccto.write(block)) {
                    break
                }
            }
            await staccato.end()
        })
    }
})
