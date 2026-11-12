---
name: land
description: >-
  Merge this thread's changes by committing them and pushing to `origin`. Use
  only when the user has explicitly requested a merge, such as the Merge Changes
  action or a request to merge or push the thread's work. Do not invoke for
  review, preparation, or passing checks alone.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Merge

Merging means the thread's work is committed and pushed to `origin`. An explicit
merge request — the Merge Changes action or equivalent user language — is the
trigger: proceed with this workflow instead of asking whether to merge. Stop only
for the blockers under Gates and Divergence.

That frontmatter is the whole Delta contract, and its values are not free:
`metadata.delta-action: land` is what makes this skill selectable under Merge
and is lowercase `land` even though the action is called Merge; the default
`user-invocable` keeps it in the Merge Skills menu; and
`disable-model-invocation` stops an agent from merging on its own initiative.

## 1. Preflight (read-only)

- `git remote -v`: the merge target is `origin`, whatever it points at. If
  `origin` is missing, stop and report instead of guessing.
- `git status --short --branch`: note the current branch and the uncommitted and
  untracked work; that work is what gets merged.
- `git fetch origin` then `git rev-parse --verify origin/main`: find out whether
  the remote already has `main`. A brand-new remote has none, and the first
  merge creates it.

## 2. Comment pass (required)

Before committing, apply the rules in `.agents/skills/jsdocs/SKILL.md` to
the files being merged: delete filler comments and comments that restate what
the code already makes clear, keep only comments that explain why, and leave the
public API documentation alone. Report what was removed. This runs before the
checks so the verified artifact is what gets pushed.

## 3. Verify

Do not use `vp run -r` or `vp run -t`. `-t` runs a package and the packages it
depends on, which is the wrong direction: the tests that import a change live
in its dependents. Vitest's `related` follows that import graph
([`vitest related`](https://vitest.dev/guide/cli.html#vitest-related)).

The merge diff is `git diff --name-only origin/main` (committed and unstaged)
plus untracked files (`git ls-files --others --exclude-standard`). When
`origin/main` does not exist yet, the diff is the files about to be committed.
A path belongs to the nearest ancestor directory, other than the repository
root, that contains a `package.json`. Root files select nothing. An empty set
is success: say that no package changed and do not substitute a
repository-wide run.

Build only those packages, and only when `scripts.build` exists. Repeat
`--filter` once per package:

```bash
vp run --fail-if-no-match --filter <name> build
```

Test with `related`, not by running each package's whole suite. Pass the
absolute paths of the changed `*.ts`, `*.tsx`, `*.js`, and `*.mjs` files.
`--filter ...<name>` is the changed package plus the packages that depend on
it; packages without `scripts.test` are skipped by `vp run`. One `--filter` per
changed package:

```bash
vp run --fail-if-no-match --filter ...<name> test -- related <files> --run --passWithNoTests
```

`--run` is required so Vitest does not stay in watch mode. A package whose
graph does not import those files exits 0 because of `--passWithNoTests`. Skip
the test command when the diff has no source files of those extensions.

Any other failure — a failing test, a failing build, a filter that matched
nothing — stops the merge. Never treat a started, pending, or partial run as
success.

## 4. Commit

- `git add -A`; `.gitignore` keeps `node_modules`, `dist`, and similar output
  out of the commit.
- Commit on the current branch (`main`) with a message describing the merged
  change. No signing, CLA, or contributor-agreement step is configured.

## 5. Push

- `origin/main` absent: `git push -u origin main`.
- `origin/main` present and fast-forwardable: `git push origin main`.
- If the push is rejected only because `main` has moved on the remote, merge it
  in and push again; a stale branch is not a reason to stop.
- If `main` is protected against direct pushes, push a branch and open a pull
  request with `gh pr create` instead. Check first with
  `gh api repos/<owner>/<repo>/branches/main/protection`, taking `<owner>/<repo>`
  from the `origin` URL.
- Never force-push.

## 6. Confirm

- `git ls-remote origin refs/heads/main` (or the pushed branch) reports the new
  commit.
- Note the target branch and commit; state plainly if the change did not reach
  the remote.

## 7. Stop the dev servers

If this thread started a dev server while developing frontend work, the merge
is not done until that process is gone: the server outlives the thread, so once
the change is merged nothing owns it any more. Stop it before you report the
result. Frontend projects under `ui/` start one through `ui/scripts/dev-server.sh`;
a server you started for any other package ends the same way.

```sh
ui/scripts/dev-server.sh stop ui/<project>
ui/scripts/dev-server.sh status ui/<project>   # exits 1 now
pgrep -f -- 'portless run --name'              # nothing under this checkout's name
```

`status` exiting 1 is the proof the URL is gone. `stop` is quiet when it has no
pidfile for this checkout, which is not an error — but if `pgrep` still lists
a server under this checkout's name (the URL's first label), end it by hand
with `kill -TERM -<pgid>` (`ps -o pgid=` for that pid). `stop` also ends the
shared portless proxy when this was the last checkout using it; the next
`start` recreates both.

A merge that stopped at Gates is not finished, so this step waits: keep the
server while you keep working, and stop it when you stop.

## Report

Delta turns the merge's outcome into a status in the thread that started the
merge from one structured result. Emit it as the last thing in your final
message: outside any code fence, the whole element alone on its own line, with
nothing after it.

```text
<land-result outcome="landed" target="main" target-url="https://github.com/<owner>/<repo>/tree/main" commit="abc1234" commit-url="https://github.com/<owner>/<repo>/commit/abc1234" />
```

- Build both URLs from the `origin` URL; `<owner>/<repo>` above is a placeholder,
  not a link to copy.

- `outcome` is `landed` only once Confirm saw the commit on the target ref. Use
  `failed` when Gates stopped the merge, and put the blocking reason in the
  element's body
  (`<land-result outcome="failed" target="main">…</land-result>`).
- Keep the attribute order above and add `ci-status`/`ci-url` after it only when
  CI actually ran for that commit. Never invent a link or identifier.
- A merge still waiting on a person, a review, or a running job is neither
  outcome: say that in prose and emit no element.
- The surrounding prose stays readable on its own and does not repeat what the
  element already says.

## Divergence

A remote that has advanced is not a conflict: merge it in (`git merge
origin/main`), re-run Verify on the packages that differ from `origin/main`,
and push. Stop only when git reports a conflict it cannot merge, or when those
checks fail. Never force-push. Confirm and Stop the dev servers still apply
after the retried push.

## Gates

Stop and report without bypassing when: `origin` is missing; a `related` test or
a changed package's `build` fails for a reason other than having no test files; a
merge needs a conflict resolved by hand; the push is rejected for a reason other
than the remote having advanced; or the scope of the change is ambiguous.
