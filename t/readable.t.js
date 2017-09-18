require('proof')(2, require('cadence')(prove))

function prove (async, assert) {
    var Staccato = { Readable: require('../readable') }
    var delta = require('delta')
    var stream = require('stream')
    async(function () {
        var through = new stream.PassThrough
        var staccato = new Staccato.Readable(through)
        var gathered = []
        async(function () {
            var loop = async(function () {
                staccato.read(1, async())
            }, function (buffer) {
                if (buffer == null) {
                    return [ loop.break ]
                }
                gathered.push(buffer)
            })()
        }, function () {
            assert(Buffer.concat(gathered).toString(), 'a', 'gathered')
        })
        async(function () {
            setImmediate(async())
        }, function () {
            delta(async()).ee(through).on('end')
            through.write(new Buffer('a'))
            through.end()
        })
    }, function () {
        var through = new stream.PassThrough
        var staccato = new Staccato.Readable(through)
        async(function () {
            staccato.read(async())
            staccato.destroy()
        }, function () {
            assert(staccato.destroy, 'destroyed and canceled')
        })
    })
}
