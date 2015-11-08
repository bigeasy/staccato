[![Build Status](https://travis-ci.org/bigeasy/staccato.svg?branch=master)](https://travis-ci.org/bigeasy/staccato) [![Coverage Status](https://coveralls.io/repos/bigeasy/staccato/badge.svg?branch=master&service=github)](https://coveralls.io/github/bigeasy/staccato?branch=master)

Write to a Node.js stream using the error-first callback style. Staccato is part
of the [Cadence](https://github.com/bigeasy/cadence) Universe. With it you can
feed a stream using error-first callbacks, a write to the stream will block if
the stream is paused or if there is too much back-pressure, so you can generate
a stream from a Cadence loop and the loop will pause when the stream is full.


```javascript
var Staccato = require('staccato')
var out = new Staccato(fs.createWriteStream('./out.txt'))

var writer = cadence(function (async, bytes) {
    var written = 0
    var loop = async(function () {
        crypto.randomBytes(1024, async())
    }, function (bytes) {
        written += bytes.length
        out.write(bytes, async())
    }, function () {
        if (written >= bytes) {
            return [ loop.break ]
        }
    })()
})

writer(function (error) { if (error) throw error })
```
