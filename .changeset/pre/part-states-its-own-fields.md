---
"@trajs/core": minor
---

A trajectory part is one schema. `PromptPart`, `SessionPart`, `ResponsePart`,
`EventPart`, and `MetricPart` state every field of the part.
The `*Meta` and `*Body` schemas beside them are removed, with their `*Encoded`
aliases and the `Meta` union that gathered the meta of every kind.
The stored form of a part does not change.
