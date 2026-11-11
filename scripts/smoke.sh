#!/usr/bin/env bash
# Browser smoke check: real key events must come out as the same text on the page, in real time, with no
# console errors. The physics has its own tests (npm test); this covers the path from keyboard to ink.
#
#   npm run dev -- --port 5179 &        # the app must be running
#   PWCLI=~/.claude/skills/playwright/scripts/playwright_cli.sh scripts/smoke.sh
#
# Run it from a scratch directory: the Playwright CLI drops working files into ./.playwright-cli.
set -euo pipefail
: "${PWCLI:?set PWCLI to the playwright-cli wrapper}"
URL="${URL:-http://localhost:5179/}"
q() { "$PWCLI" "$@" >/dev/null 2>&1; }
ev() { "$PWCLI" eval "$1" 2>&1 | grep -v '^###\|^```\|^await\|^$' | head -"${2:-3}"; }

q open "$URL" || true
q resize 1920 1080
q reload
sleep 2
ev "() => { window.__f = []; app.onFrame.push((dt, done) => { if (!app.tw.idle) window.__f.push([dt, done]); }); return 'hooked'; }" 1 >/dev/null
q type "Smoke test: 44 keys, 1 spring."
q press Enter
q type "Second line"
q press Backspace
q type "E"
sleep 5
got=$(ev "() => document.querySelector('.sr-only').textContent.replace(/\n/g, '|')" 1 | tr -d '"')
ratio=$(ev "() => { const a = window.__f; const real = a.reduce((s, x) => s + x[0], 0), sim = a.reduce((s, x) => s + x[1], 0); return (sim / real).toFixed(3) + ' at ' + Math.round(a.length / real) + ' fps'; }" 1 | tr -d '"')
state=$(ev "() => 'pending ' + app.typist.pending + ', idle ' + app.tw.idle" 1 | tr -d '"')
errors=$("$PWCLI" console 2>&1 | grep -o "Errors: [0-9]*" | head -1)
want="Smoke test: 44 keys, 1 spring.|Second linE"
echo "page:    $got"
echo "speed:   real-time ratio $ratio"
echo "state:   $state"
echo "console: ${errors:-unknown}"
# The overstruck last letter reads as the later character (E over e).
if [[ "$got" == "$want" && "$state" == "pending 0, idle true" && "$errors" == "Errors: 0" ]]; then echo "smoke: ok"; else echo "smoke: FAILED (wanted: $want)"; exit 1; fi
