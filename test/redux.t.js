require('proof')(17, async okay => {
    const stream = require('stream')
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

    // When you are done with calls to Staccato you must call destroy. This will
    // redirect any remaining errors to the uncaught error handler.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.write('a')
        through.write('b')
        through.write('c')
        through.end()

        const gathered = []
        for await (const block of staccato) {
            gathered.push(block)
        }

        staccato.close()

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }
    //

    // You can use `read` directly and you can pass it a count.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.write('abc')
        through.end()

        const gathered = []
        for (;;) {
            const block = await staccato.read(1)
            if (block == null) {
                break
            }
            gathered.push(block)
        }

        staccato.close()

        okay(gathered.length, 3, 'byte at a time')
        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }
    //

    // If there is any sort of error the stream returns `null` early. The errors
    // will be raised when you call `close()`.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        through.emit('error', new Error('error'))

        try {
            const gathered = []
            for (;;) {
                const block = await staccato.read(1)
                if (block == null) {
                    break
                }
                gathered.push(block)
            }

            staccato.close()
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
                const block = await staccato.read(1)
                staccato.raise()
                if (block == null) {
                    break
                }
                gathered.push(block)
                through.emit('error', new Error('error'))
            }
            staccato.close()
        } catch (error) {
            console.log(`\n${error.stack}\n`)
            okay(error.errors[0].message, 'error', 'raised error at close')
        }
    }
    //

    // When you write you will get a boolean telling you if the stream closed
    // for some reason. You should stop writing at that point and eventually
    // check for errors.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
        const staccato = new Staccato(through)

        try {
            for (const letter of [ 'a', 'b', 'c' ]) {
                const promise = staccato.write(letter)
                if (promise != null && ! await promise) {
                    break
                }
                through.emit('error', new Error('error'))
            }
            await staccato.end()
            staccato.close()
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
            const promise = staccato.write(letter)
            if (promise != null && ! await promise) {
                console.log('breaking')
                break
            }
        }
        await staccato.end()
        staccato.close()

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
                const promise = staccato.write(string)
                if (promise != null && ! await promise) {
                    console.log('breaking')
                    break
                }
            }
            await staccato.end()
            staccato.close()
        } ()

        const gathered = []
        for (;;) {
            await new Promise(resolve => through.once('readable', resolve))
            const block = through.read()
            if (block == null) {
                break
            }
            gathered.push(block)
        }

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'gathered')
    }
    //

    // Sometimes you might want to raise your own errors and include any
    // Staccato errors in an aggegrate error. The `errors()` method will return
    // an array containing the errors caught by Staccato. If there are no errors
    // the array is empty.

    // After you've called `errors()`, so long as no new errors arrive `close()`
    // will not raise an exception. You can ensure that no errors arrive by
    // calling `close()` synchronously before the next tick.

    //
    {
        const through = new stream.PassThrough({ emitClose: false })
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
                staccato.close()
            }
        } catch (error) {
            okay(error.errors.length, 2, 'both errors in aggregate')
        }
    }
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
        for await (const block of staccato) {
            gathered.push(block)
        }
        staccato.close()

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
        for await (const block of staccato) {
            gathered.push(block)
        }
        staccato.close()

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')

        through.emit('error', new Error('raised'))
    }

    {
        const through = new stream.PassThrough
        const finish = once(through, [ 'finish' ])
        through.end()
        await finish.promise
        const staccato = new Staccato(through)
        await staccato.end()
        try {
            staccato.close()
        } catch (error) {
            okay(error instanceof Staccato.Error, 'end error caught')
        }
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
