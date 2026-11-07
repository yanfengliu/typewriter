# Devlog Summary

- 2026-11-07: **Fast typing is retained while the mechanism catches up** — added ordered buffering for letters and controls, snapshots of Shift/ribbon/force, a visible queue count, retained margin overflow and an unload warning for unprinted input. Eleven new regressions cover bursts and control ordering without changing permanent ink semantics.

- 2026-11-07: **Independent review protected saved sheets and repaired clickable Shift** — stale tabs now stop saving when another tab changes storage; pointer Shift stays armed through the next clicked character. Added five persistence regressions and verified both repairs in headless Chrome.

- 2026-11-07: **Atelier turns keyboard strokes into permanent simulated ink** — added the procedural 3D machine, fixed-step contact-driven typebars, escapement and paper feed, overstrikes, collision jams, sound, local sheet archive and PNG export. Physical parameters are illustrative; the paper follows a constrained platen path. See [work record](../work/0_mechanical-typewriter/plan.md) for verification and review.
