var path = require('path'),
    stream = require('stream')

function createWritable (write, highWaterMark) {
    var writable = new stream.Writable({ highWaterMark: highWaterMark || 1024 * 16 })
    writable._write = write
    return writable
}

function write (chunk, encoding, callback) {
    callback()
}

require('proof')(2, function (step) {
    var rimraf = require('rimraf')
    step([function () {
        rimraf(path.join(__dirname, 'tmp'), step())
    }, function (_, error) {
        if (error.code != "ENOENT") throw error
    }])
}, function (step, ok) {
    var mkdirp = require('mkdirp'),
        Staccato = require('../..'),
        staccato
    step(function () {
        mkdirp(path.join(__dirname, 'tmp'), step())
    }, function () {
        staccato = new Staccato(createWritable(write), false)
        ok(staccato, 'create')
        staccato.ready(step())
    }, function () {
        staccato.write(new Buffer(1024), step())
    }, function () {
        staccato.close(step())
    }, function () {
        var writable
        staccato = new Staccato(writable = createWritable(write, 1), true)
        staccato.ready(step())
        writable.emit('open')
    }, function () {
        staccato.write(new Buffer(1024), step())
    }, function () {
        staccato.write(new Buffer(1024), step())
    }, function () {
        ok(1, 'opened')
        staccato.close(step())
    })
})
