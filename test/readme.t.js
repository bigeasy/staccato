// [![Actions Status](https://github.com/bigeasy/staccato/workflows/Node%20CI/badge.svg)](https://github.com/bigeasy/staccato/actions)
// [![codecov](https://codecov.io/gh/bigeasy/staccato/branch/master/graph/badge.svg)](https://codecov.io/gh/bigeasy/staccato)
// [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
//
// Write to a Node.js stream using `async`/`await`.
//
// | What          | Where                                         |
// | --- | --- |
// | Discussion    | https://github.com/bigeasy/staccato/issues/1  |
// | Documentation | https://bigeasy.github.io/staccato            |
// | Source        | https://github.com/bigeasy/staccato           |
// | Issues        | https://github.com/bigeasy/staccato/issues    |
// | CI            | https://travis-ci.org/bigeasy/staccato        |
// | Coverage:     | https://codecov.io/gh/bigeasy/staccato        |
// | License:      | MIT                                           |

(async () => {
    const { Duplex } = require('duplicitous')
    const socket = new Duplex
    const { Staccato } = require('..')
    const staccato = new Staccato(socket)

    socket.on('error', error => console.log(error.stack))

    await Staccato.rescue(async () => {
        for await (const buffer of staccato.readable) {
            await staccato.writable.write([ buffer ])
        }
    })

    socket.destroy()
}) ()

// I've moved all my Node.js code over to `async`/`await` and I want an
// `async`/`await` interface to sockets. This is it.
//
// The problem with an `async`/`await` interface to sockets is that the errors
// emitted by the socket to not map to exceptions. Sockets can emit multiple errors
// but a catch block will only catch a single exception.
//
// Early attempts to re-route error events to error-first callbacks had the problem
// of these dangling errors. Additionally, there was the problem of which half of
// the socket should get the error, the reader, the writer, or whoever got there
// first?
//
// In previous implementations of this library I'd decided that the errors don't
// matter to the application logic, only to the system administrator. We wouldn't
// rely on the errors to determine if communication has been cut. We'd assume that
// socket streams can truncate for any reason, network error, a poorly implemented
// client, or an attack. Our protocol do not need an error message on read. They
// can verify the contents of the messages which they ought to do anyway. On error,
// a read will just return `null` on the next read. Errors are funneled off to a
// logging mechanism.
//
// Read loops break when you get a `null` buffer as end-of-stream indicator, but
// you used to have to test for write failure. I'd like to see if I can remove the
// conditional and replace it with `try`/`catch`, not for general socket errors,
// but for the specific error of write-after-finish.
//
// Therefore, input streams truncate. That's just the way the cookie crumbles.
// Write streams close too, and when they do you get an exception.
//
// When there is only one exception to catch we can provide a wrapper function that
// will filter that exception and wave it through. This is `Socket.rescue()`.
//
// For clients, an incomplete transaction or a disconnect usually means back off
// and retry. For servers, an incomplete transaction or a disconnect means log it
// and wait for the client to come back again, perhaps throttling the client that
// can't get its act together and isn't backing-off.
//
// In addition to providing the simplified interface above, Staccato captures some
// of the fiddly bits of Node.js socket handling.
//
// The documentation says that when `write` returns `false` you're supposed to wait
// for a `"drain"` event before continuing to `write`. Staccato will do this for
// you in the `write` method. The documentation for `write` does not mention that
// `write` will also return false when an error destroys the stream. When the
// stream is destroyed there will be no `"drain"` event so waiting on a drain will
// cause the program to hang. Staccato encapsulates the drain-or-error logic.
//
// Both `end` and `finish` are so fiddly there's now a
// [`stream.finished`](https://nodejs.org/api/stream.html#stream_stream_finished_stream_options_callback)
// function in the Node.js streams API dedicated to accurately detecting whether
// not a socket has really ended or finished honest and for true. If you read the
// source for this function it is full of caveats, exceptions and reports from the
// field. Staccato employs this function and pulls some of the logic into Staccato.
// (Nice to have this function. I'm glad I wasn't imagining things.)
//
// Furthermore, this function leaves its handlers registered by default to deal
// with the dangling error problem that, again, I'm glad it wasn't just my
// imagination.
//
// Oh, yes. There is now an `async`/`await` interface to `stream.Readable`, I know.
// But it went from not raising an exception to raising an exception between
// Node.js 12 and 14. Perhaps its settled down now, but that would leave the
// problem of dangling errors unresolved, and doesn't settle the question as to
// what to do with the write side when the socket errors.
//
// Currently an alpha implementation as I walk though my code replacing the older
// Staccato with Staccato 13.
//
// ## Usage
//
// This `README.md` is also a unit test using the
// [Proof](https://github.com/bigeasy/proof) unit test framework. We'll use the
// Proof `okay` function to assert out statements in the readme. A Proof unit test
// generally looks like this.

require('proof')(19, async okay => {
    const { Staccato } = require('..')

    // Staccato was indented for use primarily with sockets which is a duplex stream,
    // so our examples are going use a duplex stream. Rather than setting up and
    // tearing down a server in each test, we're going to use module called Duplicitous
    // which provides a mock duplex stream.

    const { Duplex } = require('duplicitous')

    // Staccato believes that streams just truncate sometimes. This may or may not be
    // an error that will be reported by the transport. The sender could just close the
    // socket. There's always an application requirement to validate the the data that
    // came from the outside. With that in mind, if an error occurs, Staccato will stop
    // returning blocks as if the stream had ended via `end()`. You should have an
    // error handler registered on the stream you provide to Staccato to log the error.
    //
    // To read from the stream you use `staccato.readable`. When you reference
    // `staccato.readable`, Staccato begins to treat the underlying stream as a
    // `Readable` stream. If you never reference it, staccato will ingnore it.

    {
        const socket = new Duplex
        const staccato = new Staccato(socket)

        socket.input.write('a')
        socket.input.write('b')
        socket.input.write('c')
        socket.input.end()

        const gathered = []
        for await (const block of staccato.readable) {
            gathered.push(block)
        }

        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }

    // You can use `read` from `staccato.readable` and you can pass it a `size` which
    // will await for `size` bytes before returning unless the stream has ended and
    // less than `size` bytes are all that is left.

    {
        const duplex = new Duplex
        const staccato = new Staccato(duplex)

        duplex.input.write('abc')
        duplex.input.end()

        const gathered = []
        for (;;) {
            const block = await staccato.readable.read(1)
            if (block == null) {
                break
            }
            gathered.push(block)
        }

        okay(gathered.length, 3, 'byte at a time')
        okay(Buffer.concat(gathered).toString(), 'abc', 'read')
    }

    // Staccato will swallow the first error that occurs. It registers a `once` error
    // handler so it detect the error and stop reading. It has no choice but to do so.
    // A `Readable` stream will not always emit `end` after an error occurs. You must
    // register your own error handler on the stream you provide to report any errors.

    {
        const duplex = new Duplex
        const staccato = new Staccato(duplex)

        duplex.emit('error', new Error('error'))

        const gathered = []
        for (;;) {
            const block = await staccato.readable.read(1)
            if (block == null) {
                break
            }
            gathered.push(block)
        }
        okay(gathered.length, 0, 'read stops on error')
    }

    // The Staccato write method is an `async` function. The `Writable.write` method is
    // synchronous. If returns `false` if you've reached the high water mark of the
    // buffer, or if an error occurred and write stream has finished. The async
    // `Staccato.write` performs this check and will asynchronously await the `"drain"`
    // if necessary.
    //
    // The `Staccato.write` accepts an array of buffers so it attempt can write all the
    // buffers you have available with synchronous calls to `Writable.write` and reduce
    // the trips to the micro-task queue.
    //
    // Here we leave our write loop early because of an error.

    {
        const duplex = new Duplex
        const staccato = new Staccato(duplex)

        for (const letter of [ 'a', 'b', 'c' ]) {
            await staccato.writable.write([ letter ])
        }
        staccato.writable.end()

        okay(String(duplex.output.read()), 'abc', 'written')
    }

    // If you write after an error an `Staccato.Error` is thrown with a `code` property
    // of `"WRITE_AFTER_FINISH"` and `symbol` property of
    // `Staccato.Error.WRITE_AFTER_FINISH`.

    {
        const duplex = new Duplex
        const staccato = new Staccato(duplex)
        try {
            for (const letter of [ 'a', 'b', 'c' ]) {
                await staccato.writable.write([ letter ])
                duplex.emit('error', new Error('error'))
            }
            staccato.writable.end()
        } catch (error) {
            okay(error.symbol, Staccato.Error.WRITE_AFTER_FINISH, 'raised error at close')
        }
    }

    // You can use `Staccato.rescue()` to recover from the error and move on. You
    // swallow the error when you do this so be sure to have that listener registered
    // on the stream's error event.

    {
        const errors = []
        const duplex = new Duplex
        duplex.on('error', error => errors.push(error.message))
        const staccato = new Staccato(duplex)
        await Staccato.rescue(async () => {
            for (const letter of [ 'a', 'b', 'c' ]) {
                await staccato.writable.write([ letter ])
                duplex.emit('error', new Error('error'))
            }
            staccato.writable.end()
        })
        okay(errors, [ 'error' ], 'errors occured')
    }

    // If there is no error, `Staccato.rescue()` returns normally.

    {
        const errors = []
        const duplex = new Duplex
        duplex.on('error', error => errors.push(error.message))
        const staccato = new Staccato(duplex)
        await Staccato.rescue(async () => {
            for (const letter of [ 'a', 'b', 'c' ]) {
                await staccato.writable.write([ letter ])
            }
            staccato.writable.end()
        })
        okay(errors, [], 'no errors occured')
        okay(String(duplex.output.read()), 'abc', 'no errors occured data written')
    }

    // If there is an exception is raised other than a
    // `Staccato.Error.WRITE_AFTER_FINISH` the exception is rethrown.

    {
        const caught = []
        const duplex = new Duplex
        duplex.on('error', error => errors.push(error.message))
        const staccato = new Staccato(duplex)
        try {
            await Staccato.rescue(async () => {
                for (const letter of [ 'a', 'b', 'c' ]) {
                    await staccato.writable.write([ letter ])
                    throw new Error('thrown')
                }
                staccato.writable.end()
            })
        } catch (error) {
            caught.push(error.message)
        }
        okay(caught, [ 'thrown' ], 'exception rethrown')
    }

    // You can also use rescue with a `Promise`.

    {
        const errors = []
        const duplex = new Duplex
        duplex.on('error', error => errors.push(error.message))
        const staccato = new Staccato(duplex)
        const promise = async function () {
            for (const letter of [ 'a', 'b', 'c' ]) {
                await staccato.writable.write([ letter ])
            }
            staccato.writable.end()
        } ()
        await Staccato.rescue(promise)
        okay(errors, [], 'no errors occured')
        okay(String(duplex.output.read()), 'abc', 'no errors occured data written')
    }

    // If you want to, you can perform the writes synchronously using
    // `Staccato.writable.stream.write()` but you'll have to perform the
    // drain-or-error check yourself. You can use `Staccato.writable.drain()`.
    // It will not hang forever if the stream has finished. It will return if
    // the stream finishes before the drain.
    //
    // To keep from looping forever on this condition, you should check the
    // `finished` property of `staccato.writable` before writing. If the stream
    // is finished `staccato.write()` will always return true and `drain()` is a
    // no-op.

    {
        const duplex = new Duplex
        duplex.on('error', error => console.log(error))
        const staccato = new Staccato(duplex)

        for (const letter of [ 'a', 'b', 'c' ]) {
            if (staccato.writable.finished) {
                break
            }
            if (!staccato.stream.write(letter)) {
                await staccato.writable.drain()
            }
        }
        staccato.writable.end()

        okay(duplex.output.read().toString(), 'abc', 'wrote')
    }

    // You can't wait for errors. They can arrive after you've moved onto other
    // things. They arrive at any time. Some gremlin in your code could `write`
    // to the socket a week after you've successfully served a request and
    // the socket will emit an error.
    //
    // You can wait for the socket to `end` and `finish` though, so Staccato
    // provides a `done()` function. It returns a `Promise` if either `readable`
    // has not yet ended or `writable` has not yet finished.
    //
    // If you haven't called the `readable` property getter it does not exist
    // and there is no `"end"` listener registered. If you haven't called the
    // `writable` property getter it does not exist and there is no `"finish"`
    // listener registered.
    //
    // Therefore in this example we're only waiting for writable to finish.

    {
        const duplex = new Duplex
        duplex.on('error', error => console.log(error))
        const staccato = new Staccato(duplex)

        for (const letter of [ 'a', 'b', 'c' ]) {
            if (staccato.writable.finished) {
                break
            }
            if (!staccato.stream.write(letter)) {
                await staccato.writable.drain()
            }
        }
        staccato.writable.end()

        const promise = staccato.done()
        if (promise != null) {
            await promise
        }

        okay(staccato.done(), null, 'once done, done is async')
        okay(duplex.output.read().toString(), 'abc', 'wrote')
    }

    // Staccato will handle drain correctly.

    {
        const duplex = new Duplex({ writableHighWaterMark: 2 })
        const staccato = new Staccato(duplex)

        const promise = async function () {
            await staccato.writable.write([ 'abc', 'def' ])
            staccato.writable.end()
        } ()

        const gathered = []
        duplex.output.on('readable', () => {
            for (;;) {
                const block = duplex.output.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await new Promise(resolve => duplex.output.once('end', resolve))
        await promise

        okay(Buffer.concat(gathered).toString(), 'abcdef', 'drained')
    }

    // Note that write accepts any form of iterable.

    {
        const duplex = new Duplex
        duplex.on('error', error => conosle.log(error))
        const staccato = new Staccato(duplex)

        await staccato.writable.write(function* () {
            for (const string of [ 'abc', 'def' ]) {
                yield string
            }
        } ())
        staccato.writable.end()

        await new Promise(resolve => duplex.output.once('finish', resolve))

        okay(String(duplex.output.read()), 'abcdef', 'iterated')
    }

    // `Staccato.writeable.consume()` accepts an `async` iterator that returns arrays
    // of buffers. With it you can consume a stream without writing a loop yourself. I
    // use it to consume queues created by the Avenue work queue so that my code is
    // just a matter of connecting pipelines.

    {
        const duplex = new Duplex
        duplex.on('error', error => conosle.log(error))
        const staccato = new Staccato(duplex)

        await staccato.writable.consume(async function* () {
            for (const buffers of [[ 'abc', 'def' ], [ 'ghi' ]]) {
                yield buffers
            }
        } ())
        staccato.writable.end()

        await new Promise(resolve => duplex.output.once('finish', resolve))

        okay(String(duplex.output.read()), 'abcdefghi', 'async iterated')
    }

    // It will also correctly handle write back-pressure and drain.

    {
        const duplex = new Duplex({ writableHighWaterMark: 2 })
        const staccato = new Staccato(duplex)

        const promise = async function () {
            await staccato.writable.consume(async function* () {
                for (const buffers of [[ 'abc', 'def' ], [ 'ghi' ]]) {
                    yield buffers
                }
            } ())
            staccato.writable.end()
        } ()

        const gathered = []
        duplex.output.on('readable', () => {
            for (;;) {
                const block = duplex.output.read()
                if (block == null) {
                    break
                }
                gathered.push(block)
            }
        })

        await new Promise(resolve => duplex.output.once('end', resolve))
        await promise

        okay(Buffer.concat(gathered).toString(), 'abcdefghi', 'async iterated drained')
    }
})

// You can run this unit test yourself to see the output from the various
// code sections of the readme.

// The `'staccato'` module exports a single `Staccato` object.
