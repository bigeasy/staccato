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
return
require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Staccato = { Readable: require('../readable') }
    var delta = require('delta')
    var stream = require('stream')
    async(function () {
        var through = new stream.PassThrough
        var readable = new Staccato.Readable(through)
        var gathered = []
        async(function () {
            async.loop([], function () {
                readable.read(1, async())
            }, function (buffer) {
                if (buffer == null) {
                    readable.raise()
                    return [ async.break ]
                }
                gathered.push(buffer)
            })
        }, function () {
            okay(Buffer.concat(gathered).toString(), 'a', 'gathered')
        })
        async(function () {
            setImmediate(async())
        }, function () {
            delta(async()).ee(through).on('end')
            through.write(Buffer.from('a'))
            through.end()
        })
    }, function () {
        var through = new stream.PassThrough
        var readable = new Staccato.Readable(through)
        async(function () {
            readable.read(async())
            readable.destroy()
        }, function () {
            okay(readable.destroy, 'destroyed and canceled')
        })
    }, function () {
        var through = new stream.PassThrough
        var readable = new Staccato.Readable(through)
        through.emit('error', new Error('errored'))
        async(function () {
            readable.read(async())
        }, function (read) {
            okay(read, null, 'error end of stream')
            okay(readable.error.message, 'errored', 'error gathered')
            try {
                readable.raise()
            } catch (e) {
                okay(e.message, 'errored', 'error raised')
            }
            readable.destroy()
        })
    })
}
