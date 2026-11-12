#!/bin/sh
# Serve a project under ui/ at https://<project>-<checkout>.<tld>.
#
#   Caddy :443  ->  portless proxy :8080  ->  pnpm run dev (in the project)
#
# The proxy runs unprivileged on 8080 because the machine's Caddy already holds
# 443 and 80, and Caddy is what turns the route into an https:// URL without a
# port number. Nothing here needs root.
#
# usage: ui/scripts/dev-server.sh <start|url|status|stop> <project-dir>
#
# Two worktrees of the same project can serve at once, so the route name carries
# a hash of the checkout path and `stop` ends exactly the server this checkout
# started.
set -eu

cmd=${1:-}
project=${2:-}

usage() {
  echo "usage: $0 <start|url|status|stop> <project-dir>" >&2
  exit 2
}

[ -n "$cmd" ] && [ -n "$project" ] || usage
[ -f "$project/package.json" ] || { echo "$project has no package.json" >&2; exit 2; }
grep -q '"dev"[[:space:]]*:' "$project/package.json" || { echo "$project has no dev script" >&2; exit 2; }

cd "$project"
PROJECT_DIR=$PWD

NAME=${DEV_NAME:-$(basename "$PROJECT_DIR")-$(printf '%s' "$PROJECT_DIR" | shasum | cut -c1-6)}
TLD=${DEV_TLD:-localhost}
LOG="/tmp/$NAME.log"
PIDFILE="/tmp/$NAME.pid"
URL="https://$NAME.$TLD"

# Portless reads its settings from the environment; the proxy's flags only count
# the first time it starts.
export PORTLESS_PORT=8080 PORTLESS_HTTPS=0 PORTLESS_UNPRIVILEGED=1 PORTLESS_TLD="$TLD"

up() { curl -fsk -o /dev/null --max-time 5 "$URL"; }

proxy_up() { nc -z 127.0.0.1 8080 2>/dev/null; }

# The proxy is shared, so it stays up while any checkout still has a route.
busy() {
  [ "$(tr -d '[:space:]' <"$HOME/.portless/routes.json" 2>/dev/null)" != '[]' ]
}

# A TLD other than .localhost only resolves and only has a certificate once the
# machine serves it; say so instead of waiting out the readiness loop.
require_tld() {
  [ "$TLD" = localhost ] && return 0
  if [ -z "$(dscacheutil -q host -a name "$NAME.$TLD")" ]; then
    echo "$NAME.$TLD does not resolve; add it to /etc/hosts (or your resolver)" >&2
    return 1
  fi
}

# Only signal the recorded group while it still runs this checkout's server:
# group ids get reused, and `stop` must never hit anything else.
stop_server() {
  [ -f "$PIDFILE" ] || return 0
  pgid=$(cat "$PIDFILE" 2>/dev/null || true)
  rm -f "$PIDFILE"
  case "$pgid" in '' | *[!0-9]*) return 0 ;; esac
  pgrep -g "$pgid" -f -- "portless run --name $NAME" >/dev/null || return 0
  kill -TERM "-$pgid" 2>/dev/null || true
}

# Vite shuts the server down when its stdin ends, so the server must not have a
# terminal as stdin: the pty goes away with the tool call that started it. From
# /dev/null stdin never ends, and a log file for stdout keeps a dying terminal
# from reaching the server at all. Job control puts the whole chain in its own
# process group so `stop` can end it with one signal.
start() {
  require_tld || return 1
  if ! pnpm exec portless --version >/dev/null 2>&1; then
    echo "portless is not installed; add it to the root package.json devDependencies, then vp install" >&2
    return 1
  fi

  if up; then
    echo "$URL"
    return 0
  fi

  proxy_up || pnpm exec portless proxy start -p 8080 --no-tls --tld "$TLD" >/dev/null
  stop_server
  set -m
  nohup sh -c "exec pnpm exec portless run --name '$NAME'" </dev/null >"$LOG" 2>&1 &
  echo "$!" >"$PIDFILE"
  set +m

  i=0
  while [ "$i" -lt 40 ]; do
    if up; then
      echo "$URL"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "dev server did not answer on $URL; see $LOG" >&2
  echo "if $LOG shows it listening, its dev script ignores \$PORT or the reverse proxy for .$TLD is missing the route" >&2
  return 1
}

case "$cmd" in
start)
  start
  ;;
url)
  echo "$URL"
  ;;
status)
  if up; then echo "$URL up"; else echo "$URL down" && exit 1; fi
  ;;
stop)
  stop_server
  # Portless drops a route a moment after its process is gone, so wait for this
  # checkout's route to clear before asking whether anything else is left.
  i=0
  while grep -q "$NAME.$TLD" "$HOME/.portless/routes.json" 2>/dev/null && [ "$i" -lt 10 ]; do
    sleep 1
    i=$((i + 1))
  done
  busy || pnpm exec portless proxy stop >/dev/null 2>&1 || true
  ;;
*)
  usage
  ;;
esac
