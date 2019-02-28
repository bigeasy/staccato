require('proof')(2, prove)

function prove (okay) {
    var Staccato = require('..')
    console.log(Staccato)
    okay(Staccato.Readable, 'readable required')
    okay(Staccato.Writable, 'writable required')
}
