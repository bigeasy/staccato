require('proof')(8, async (okay) => {
    const callback = require('comeuppance')
    const stream = require('stream')
    const Writable = require('../writable')
    const events = require('events')
    {
        const through = new stream.PassThrough({ highWaterMark: 2 })
        const writable = new Writable(through)
        okay(await writable.write(Buffer.from('a')), 'write string')
        await callback(callback => setImmediate(callback))
        okay(through.read().toString(), 'a', 'wrote string')
        await writable.end()
        okay(! await writable.write(Buffer.from('a')), 'write after close')
    }
    {
        const through = new stream.PassThrough({ highWaterMark: 2 })
        const writable = new Writable(through)
        const promises = [ writable.write(Buffer.from('abc')), writable.write(Buffer.from('def')) ]
        await callback(callback => setImmediate(callback))
        okay(through.read().toString(), 'abcdef', 'drain')
        while (promises.length != 0) {
            await promises.shift()
        }
        await writable.end()
    }
    {
        const through = new stream.PassThrough
        const writable = new Writable(through)
        okay(await writable.write([ Buffer.from('abc'), Buffer.from('def') ]), 'write buffer')
        await callback(callback => setImmediate(callback))
        okay(through.read().toString(), 'abcdef', 'wrote buffer')
        await writable.end()
    }
    {
        const through = new stream.PassThrough
        const writable = new Writable(new class extends events.EventEmitter {
            write() {
                this.emit('error', new Error)
            }
        })
        okay(!await writable.write(Buffer.from('a')), 'failed')
        okay(writable.destroyed, 'destroyed')
        await writable.end()
    }
})
