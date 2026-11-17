---
"@trajs/utils": minor
---

`ByteStore.layerS3` keeps an id as one object of the bucket, named after the id, and reads a part
of a sequence with a range request.

`ByteStore.S3Options` names the bucket alone, since one object per id has no size to cut it to.
