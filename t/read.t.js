require('proof')(1, require('cadence')(prove))

function prove (async, assert) {
    var Staccato = require('..')
    var stream = require('stream')
    var through = new stream.PassThrough
    var staccato = new Staccato(through)
    var gathered = []
    async(function () {
        var loop = async(function () {
            staccato.read(async())
        }, function (buffer) {
            if (buffer == null) {
                return [ loop.break ]
            }
            gathered.push(buffer)
        })()
    }, function () {
        assert(Buffer.concat(gathered).toString(), 'a', 'gathered')
    })
    // A sub-cadence because we have to wait for the loop above to start.
    async(function () {
        setImmediate(async())
    }, function () {
        through.write(new Buffer('a'))
        through.end()
    })
}
