var path = require('path'), stream = require('stream'),
    proof = require('proof'), cadence = require('cadence')

function createWritable (write, highWaterMark) {
    var writable = new stream.Writable({ highWaterMark: highWaterMark || 1024 * 16 })
    writable._write = write
    return writable
}

function write (chunk, encoding, callback) {
    callback()
}

proof(4, cadence(prove))

function prove (async, assert) {
    var mkdirp = require('mkdirp'),
        Staccato = { Writable: require('../writable') },
        staccato
    var cleanup = cadence(function (async) {
        var rimraf = require('rimraf')
        async([function () {
            rimraf(path.join(__dirname, 'tmp'), async())
        }, function (error) {
            if (error.code != "ENOENT") throw error
        }])
    })
    async(function () {
        cleanup(async())
    }, function () {
        mkdirp(path.join(__dirname, 'tmp'), async())
    }, function () {
        staccato = new Staccato.Writable(createWritable(write), false)
        assert(staccato, 'create')
    }, function () {
        staccato.write(new Buffer(1024), async())
    }, function () {
        staccato.end(async())
    }, function () {
        var writable
        staccato = new Staccato.Writable(writable = createWritable(write, 1), true)
        staccato.write(new Buffer(1024), async())
    }, function () {
        staccato.write(new Buffer(1024), async())
    }, function () {
        assert(1, 'opened and drained')
        staccato.end(async())
    }, [function () {
        var writable
        staccato = new Staccato.Writable(writable = createWritable(write, 1), true)
        async(function () {
            staccato.write(new Buffer(1024), async())
        })()
        writable.emit('error', new Error('foo'))
    }, function (error) {
        assert(/^staccato#destroyed$/m.test(error.message), 'error caught')
    }], function () {
        staccato = new Staccato.Writable(createWritable(write, 1), true)
        staccato.destroy()
        assert(staccato.destroyed, 'destroyed')
        staccato.destroy()
    }, function () {
        if (!('UNTIDY' in process.env)) {
            cleanup(async())
        }
    })
}
