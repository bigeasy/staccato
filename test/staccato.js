describe('staccato', () => {
    const assert = require('assert')
    it('can export readable and writable', () => {
        const Staccato = require('..')
        assert(Staccato.Readable, 'readable')
        assert(Staccato.Writable, 'readable')
    })
})
