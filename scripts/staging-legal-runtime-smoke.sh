#!/usr/bin/env bash
set -euo pipefail
node scripts/staging-unified-demo-live-smoke.mjs
node scripts/staging-email-invite-startup-smoke.mjs
