describe('wrtiable', () => {
    const callback = require('prospective/callback')
    const stream = require('stream')
    const assert = require('assert')
    const Writable = require('../writable')
    const events = require('events')
    it('can write', async () => {
        const through = new stream.PassThrough({ highWaterMark: 2 })
        const writable = new Writable(through)
        assert(await writable.write(Buffer.from('a')), 'wrote')
        await callback(callback => setImmediate(callback))
        assert.equal(through.read().toString(), 'a', 'write')
        await writable.end()
        assert(! await writable.write(Buffer.from('a')), 'write after close')
    })
    it('can drain', async () => {
        const through = new stream.PassThrough({ highWaterMark: 2 })
        const writable = new Writable(through)
        const promises = [ writable.write(Buffer.from('abc')), writable.write(Buffer.from('def')) ]
        await callback(callback => setImmediate(callback))
        assert.equal(through.read().toString(), 'abcdef', 'write')
        while (promises.length != 0) {
            await promises.shift()
        }
        await writable.end()
    })
    it('can write buffers', async () => {
        const through = new stream.PassThrough
        const writable = new Writable(through)
        assert(await writable.write([ Buffer.from('abc'), Buffer.from('def') ]), 'wrote')
        await callback(callback => setImmediate(callback))
        assert.equal(through.read().toString(), 'abcdef', 'write')
        await writable.end()
    })
    it('can stop on error', async () => {
        const through = new stream.PassThrough
        const writable = new Writable(new class extends events.EventEmitter {
            write() {
                this.emit('error', new Error)
            }
        })
        assert(!await writable.write(Buffer.from('a')), 'failed')
        assert(writable.destroyed, 'destroyed')
        await writable.end()
    })
})
