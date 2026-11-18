---
"@trajs/utils": minor
---

`BinaryProtocol.u64` states an unsigned 64-bit integer field, read and written
big-endian like the narrower integer fields. Its value is a `bigint`, since a
number holds an integer exactly only up to 2^53 - 1.

`BinaryProtocol.decodeTo` states the value a field's bytes hold by composing a
schema onto the codec of the field. A code byte is read as the code it states
and a counted run as the text it holds, while the bytes the field spans stay the
same.

`BinaryProtocol.layout` reads and writes the bytes its fields state: integers
big-endian, a byte run of a fixed length or one counted by an earlier field, and
any other schema as one `SchemaBinary` frame. Decoding fails where the bytes end
inside a field or hold more than the fields state. Encoding fails where a run
holds another number of bytes than its wire states, or a value is of another
range than its field. A length is a number, so an eight-byte field counts no
run.
