require('proof')(7, require('cadence')(prove))

function prove (async, okay) {
    var Staccato = { Writable: require('../writable') }
    var stream = require('stream')
    var through, writable
    async(function () {
        through= new stream.PassThrough({ highWaterMark: 2 })
        writable = new Staccato.Writable(through)
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
        setImmediate(async()) // Let PassThrough `"end"`.
    }, function () {
        through = new stream.PassThrough({ highWaterMark: 2 })
        through.write = function () {
            this.emit('error', new Error)
            return false
        }
        writable = new Staccato.Writable(through)
        writable.write(Buffer.from('a'), async())
    }, function (wrote) {
        okay(!wrote, 'error on write')
        okay(writable.destroyed, 'error on write destroyed')
    })
}
