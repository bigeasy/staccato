# Transcript Diary

## Concerns and Decisions

 * For now, let's always have the footer be a plain-old JavaScript object.
 * Opening a transcript can be from the first record or the footer.
 * You can seek into the transcript, then play forward from there.
 * Writing to the transcript appends, flushing writes the footer.
