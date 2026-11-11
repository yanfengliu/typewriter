#!/usr/bin/env bash
# Walk the guided tour in a real browser and save a full-resolution screenshot of every step.
#
#   npm run dev -- --port 5179 &        # the app must be running
#   PWCLI=~/.claude/skills/playwright/scripts/playwright_cli.sh scripts/walk-tour.sh [first] [last]
#
# Run it from a scratch directory: the Playwright CLI drops working files into ./.playwright-cli.
# Screenshots go to output/playwright/tour/ in the repo (ignored by git).
set -euo pipefail
: "${PWCLI:?set PWCLI to the playwright-cli wrapper}"
URL="${URL:-http://localhost:5179/}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/output/playwright/tour"
FROM="${1:-0}"; TO="${2:-17}"
mkdir -p "$OUT"
"$PWCLI" open "$URL" >/dev/null 2>&1 || true
"$PWCLI" resize 1920 1080 >/dev/null 2>&1
"$PWCLI" reload >/dev/null 2>&1
sleep 2
for i in $(seq "$FROM" "$TO"); do
  "$PWCLI" eval "async () => { ui.tour.start($i); const t0 = performance.now(); await new Promise(r => setTimeout(r, 1500)); while (ui.tour.running && performance.now() - t0 < 25000) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 700)); return { i: $i, title: ui.tour.step.title, running: ui.tour.running, wall: Math.round(performance.now() - t0), marks: app.tw.marks.length }; }" 2>&1 | grep -E '"(i|title|running|wall|marks)"' | tr -d '\n'
  echo
  "$PWCLI" screenshot >/dev/null 2>&1
  cp "$(ls -t .playwright-cli/*.png | head -1)" "$OUT/step-$(printf '%02d' "$i").png"
done
"$PWCLI" console 2>&1 | grep -E "Total messages" || true
