describe('readable', () => {
    const assert = require('assert')
    const stream = require('stream')
    const Readable = require('../readable')
    it('can read', async () => {
        const test = []
        const through = new stream.PassThrough
        through.write(Buffer.from('a'))
        through.end()
        const readable = new Readable(through)
        for await (let chunk of readable) {
            test.push(chunk.toString())
        }
        assert.deepStrictEqual(test, [ 'a' ], 'test')
    })
    it('can break', async () => {
        const test = []
        const through = new stream.PassThrough
        through.write(Buffer.from('a'))
        through.end()
        const readable = new Readable(through)
        for await (let chunk of readable) {
            test.push(chunk.toString())
            break
        }
        assert.deepStrictEqual(test, [ 'a' ], 'test')
    })
    it('can await', async () => {
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
        assert.deepStrictEqual(test, [ 'a' ], 'test')
    })
    it('can read count bytes', async () => {
        const test = []
        const through = new stream.PassThrough
        const readable = new Readable(through)
        through.write(Buffer.from('abcdef'))
        through.end()
        assert.equal((await readable.read(3)).toString(), 'abc', 'chunk 1')
        assert.equal((await readable.read(3)).toString(), 'def', 'chunk 2')
        assert.equal(await readable.read(3), null, 'end')
    })
})
