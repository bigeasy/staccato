require('proof')(5, require('cadence')(prove))

function prove (async, okay) {
    var Staccato = { Writable: require('../writable') }
    var stream = require('stream')
    var through = new stream.PassThrough({ highWaterMark: 2 })
    var writable = new Staccato.Writable(through)
    async(function () {
        writable.write(Buffer.from('a'), async())
    }, function (immediate) {
        okay(immediate, 'write')
        writable.write(Buffer.from('bcdef'), async())
        okay(through.read().toString(), 'abcdef', 'written')
    }, function (drain) {
        okay(drain, 'drain')
        // Go to streaming mode.
        through.on('data', function () { console.log('data?') })
        through.on('end', function () { okay('ended') })
        writable.end(async())
    }, function () {
        writable.write(Buffer.from('a'), async())
    }, function (wrote) {
        okay(!wrote, 'write on closed')
        writable.end(async())
    }, function () {
        writable.raise()
    }, function () {
        setImmediate(async())
    })
}
