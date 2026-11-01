# Examples

Examples are optional. Keep or add one only for behavior not evident from the signature, meaningful composition, or useful inference or narrowing. Replace or remove examples that are trivial, misleading, contrived, or scaffolding-heavy.

Use `**Example** (Unique use-case title)`, optional prose, and exactly one non-empty `ts` fence. Titles must remain unique after trimming and lowercasing. Do not use `@example` tags or loose code fences.

Nothing in this repository collects examples, so no fence carries `import.meta.vitest`; the marker promises a run that never happens. Verify an example by hand against the implementation instead.

Examples use public imports and read as setup, operation, then semantic observation. An example must run as written, because a reader copies it. Prefer a direct assertion with a trailing `// =>` and the actual result. Keep the call and assertion on one line when it fits, and format expected arrays densely. Separate a later assertion block with a blank line.

- Import from the published entry point of the package, such as `@trajs/core` or `@trajs/utils/Compression`. Do not import `#/internal/*`.
- Await asynchronous work. Use `Effect.runPromise`; use `Effect.runSync` only when synchronous execution is the documented contract.
- Use `Ref`, `Deferred`, or `Queue` rather than mutable probes for concurrency, interruption, or races.
- Keep type-level examples free of tautological runtime assertions.

An example is part of the contract: it shows the behavior described above, not only a happy-path call. If example research suggests an implementation or type bug, report it instead of changing runtime code during a documentation-only pass.
