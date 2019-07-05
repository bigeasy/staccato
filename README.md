Write to a Node.js stream using `async`/`await`.

```
stream.on('error', (error) => {
    console.log(error.stack)
})

const writable = new Staccato.Writable(socket)
const readable = new Staccato.Readable(socket)

const read = Buffer.alloc(0), write = Buffer.from('begin')
while (read != null && await writable.write([ write ])) {
    write = consume(read)
    read = await readable.read()
}
```

The above shows the motivation behind this library. Writing to a socket in
Node.js is relatively undocumented. The documentation says that when `write`
returns `false` you're supposed to wait for a `"drain"` event beffore continuing
to `write`. Staccato will do this for you in the `write` method. There hasn't
been mention that `write` will also return false when an error destroys the
stream. When the stream is destroyed there will be no `"drain"` event so waiting
on a drain will cause the program to hang. Staccato encapsulates the
drain-or-error logic.

In lieu of raising an exception, on error `Staccato.Writable.write()` will
return `false`. This is because I've found that with sockets, error management
ought to be a separate concern. The error should be handled the moment it
occurs. We should not wait until the next write to raise an exception based on
the error we detected. The error detection merely marks the `Staccato.Writable`
as destroyed. Reporting the error reporting is supposed be handled in a separate
`stream.on("error", [function])` handler that can shutdown the writing process
altogether, preventing a failed write.

The associated `Staccato.Readable` class is provided to facilitate error
handling as a separate concern. It swallows errors and returns them into
end-of-stream messages. In my code, for the most part, I'm always looking for a
truncated stream in my buffer processing, so whether the stream ends prematurely
due to a detectable file or network error, or whether it ends prematurely
because it was only partially written by the other side is doesn't matter.

Most imporantly, when a duplex stream failed I'd find that I'd be detecting
errors on both read and write, so once again, it makes more sense to have error
handling be a separate concern that shuts down the duplex stream processing from
the outside of the stream processing logic.
