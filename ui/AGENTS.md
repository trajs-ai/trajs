# AGENTS.md

Project-specific guidance for AI coding agents working under `ui/`.

## Dev server (required)

Debugging a page and showing it to the user both need a running dev server, so
every task that touches a project here runs one and hands the user its URL.

```sh
ui/scripts/dev-server.sh start ui/<project>    # prints the URL; restarts if down
ui/scripts/dev-server.sh status ui/<project>   # exit 1 when the URL stops answering
ui/scripts/dev-server.sh stop ui/<project>
```

- The URL is `https://<project>-<checkout>.<tld>`, with `.localhost` as the TLD.
  Portless assigns the listening port, so the URL never carries one. Pick a
  different TLD with `DEV_TLD=<tld>` when the user asks for one: that also needs
  the machine's reverse proxy to serve `https://*.<tld>` and terminate TLS for it
  (a Caddy site block), plus the name has to resolve.
- Report the URL whenever you deliver: a change nobody can open is unverified.
  Re-run `start` before you report if `status` is not up; `start` is idempotent
  and prints the URL either way.
- Never start a project with a plain foreground `pnpm dev`, or with a background
  job that inherits the tool call's terminal: vite shuts down when its stdin
  ends, and that terminal goes away with the call. `start` detaches stdin to
  `/dev/null` and stdout to the log, which is what keeps the URL alive between
  calls.
- `stop` ends the server this checkout started and nothing else: each one runs in
  its own process group, recorded in `/tmp/<name>.pid`, with logs in
  `/tmp/<name>.log`. Nothing is registered with the OS, so no launchd job, fixed
  port or `screen` session is left behind.
- One portless proxy serves every checkout and keeps the TLD it was started with.
  Changing `DEV_TLD` therefore needs `pnpm exec portless proxy stop` first, which
  drops the URL of every other checkout until each reruns `start`.
- A project qualifies when its `dev` script serves HTTP on the `$PORT`/`$HOST`
  portless passes. A Vite dev server does; a script that hands off to another
  task does not. `portless` is a workspace dev dependency, so that is all a
  project needs.
