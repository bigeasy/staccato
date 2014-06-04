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
        Transcript = require('../..'),
        transcript
    step(function () {
        mkdirp(path.join(__dirname, 'tmp'), step())
    }, function () {
        transcript = new Transcript(path.join(__dirname, 'tmp', 'transcript'), 'w', 0)
        ok(transcript)
    })
})
