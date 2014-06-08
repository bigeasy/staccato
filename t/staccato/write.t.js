var path = require('path')

require('proof')(1, function (step) {
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
        staccato = new Staccato(path.join(__dirname, 'tmp', 'staccato'), 'w', 0)
        ok(staccato)
    })
})
