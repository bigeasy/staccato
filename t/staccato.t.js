require('proof')(2, prove)

function prove (assert) {
    var Staccato = require('..')
    console.log(Staccato)
    assert(Staccato.Readable, 'readable required')
    assert(Staccato.Writable, 'writable required')
}
