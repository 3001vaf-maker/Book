#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

sync_staging() {
  if [ -n "$(git status --porcelain)" ]; then
    return 0
  fi

  git fetch origin staging >/dev/null 2>&1 || return 0
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse origin/staging)"

  if [ "$local_sha" != "$remote_sha" ]; then
    git pull --ff-only origin staging >/dev/null 2>&1 || return 0
  fi
}

start_stack() {
  docker compose -f docker-compose.staging.yml up -d --build
}

sync_staging
start_stack

PID_FILE="/tmp/book-staging-watch.pid"
if [ -f "$PID_FILE" ]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
  fi
fi

(
  while true; do
    sleep 20
    if [ -n "$(git status --porcelain)" ]; then
      continue
    fi

    git fetch origin staging >/dev/null 2>&1 || continue
    local_sha="$(git rev-parse HEAD)"
    remote_sha="$(git rev-parse origin/staging)"
    if [ "$local_sha" = "$remote_sha" ]; then
      continue
    fi

    git pull --ff-only origin staging >/dev/null 2>&1 || continue
    docker compose -f docker-compose.staging.yml up -d --build >/tmp/book-staging-rebuild.log 2>&1 || true
  done
) >>/tmp/book-staging-watch.log 2>&1 &

echo $! > "$PID_FILE"
