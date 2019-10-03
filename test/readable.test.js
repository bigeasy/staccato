require('proof')(6, async (okay) => {
    const stream = require('stream')
    const Readable = require('../readable')
    {
        const test = []
        const through = new stream.PassThrough
        through.write(Buffer.from('a'))
        through.end()
        const readable = new Readable(through)
        for await (let chunk of readable) {
            test.push(chunk.toString())
        }
        okay(test, [ 'a' ], 'read')
    }
    {
        const test = []
        const through = new stream.PassThrough
        through.write(Buffer.from('a'))
        through.end()
        const readable = new Readable(through)
        for await (let chunk of readable) {
            test.push(chunk.toString())
            break
        }
        okay(test, [ 'a' ], 'break')
    }
    {
        const test = []
        const through = new stream.PassThrough
        const readable = new Readable(through)
        const promise = (async () => {
            for await (let chunk of readable) {
                test.push(chunk.toString())
            }
        })()
        through.write(Buffer.from('a'))
        through.end()
        await promise
        okay(test, [ 'a' ], 'await')
    }
    {
        const test = []
        const through = new stream.PassThrough
        const readable = new Readable(through)
        through.write(Buffer.from('abcdef'))
        through.end()
        okay((await readable.read(3)).toString(), 'abc', 'read chunk 1')
        okay((await readable.read(3)).toString(), 'def', 'read chunk 2')
        okay(await readable.read(3), null, 'end')
    }
})
