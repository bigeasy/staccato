require('proof')(3, async okay => {
    const Staccato = require('..')
    const Duplex = require('duplicitous')
    // Readable-only done.
    {
        const duplex = new Duplex
        duplex.on('error', error => console.log(error))
        const staccato = new Staccato(duplex)

        const read = async function () {
            for await (const block of staccato.readable) {
            }
        } ()
        duplex.input.end()

        const promise = staccato.done()
        if (promise != null) {
            await promise
        }
        await read

        okay(staccato.done(), null, 'once done, done is async')
    }
    // Drain after finish.
    {
        const duplex = new Duplex
        duplex.on('error', error => console.log(error))
        const staccato = new Staccato(duplex)

        staccato.writable.end()
        await new Promise(resolve => duplex.output.once('finish', resolve))
        staccato.writable.drain()

        okay('drain after finish')
    }
    // Start finished.
    {
        const duplex = new Duplex
        duplex.on('error', error => console.log(error))
        duplex.destroy()
        const staccato = new Staccato(duplex)
        staccato.readable
        staccato.writable
        okay('start finished')
    }
})
