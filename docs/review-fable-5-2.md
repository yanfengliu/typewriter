# Review record: physics and tests on `fable_5_2`

This record follows the fleet's review format (`../fleet/docs/work-docs.md`) but is not filed under `docs/work/`. The allocator refuses this branch: `node scripts/work-docs.mjs check --repo ../typewriter` answers "Local reservation witness contradicts registry.json", because `fable_5_2` was started empty and does not carry the registry that `main` has. Nothing was created or changed to get past that. When the owner decides how this branch relates to `main`, this file can be moved into an allocated folder as `plan.md` plus `reviews/0_implementation.md` and `reviews/1_implementation.md`.

Finding IDs are assigned once and kept across rounds.

# Review 0: implementation

## Target

Repository `typewriter`, branch `fable_5_2`, commit `07403d6`: `src/sim/` (solver, elements, mechanism, machine, typist), `tests/`, `docs/physics.md`. The reviewer re-ran finding F0 at `fd8ec20`; findings F1 to F7 were run at `07403d6` only.

## Reviewers and coverage

One reviewer: a Claude subagent started with a fresh context and no part in writing the code. Lens: is the physics correct, do the tests prove what the docs claim. Access: read the repository and ran its own experiments in a scratch directory. The view and interface code were read only where they touch the simulation. No reviewer from a second model family took part; the fleet's multi-CLI review was not run.

## Reports

### Claude subagent (fresh context)

Redaction: absolute paths on the reviewer's machine are shortened to repository-relative paths, and its scratch experiment scripts to `<scratch>/review/…`. Those scripts were not kept; the repository tests named under "Findings and disposition" reproduce each finding. Nothing else is changed.

**Physics review at 07403d6.** I found no math error in the solver or elements. There is one serious bug, in the typist; the rest are medium or low. Finding 1 was re-run at fd8ec20 and still reproduces; findings 2–6 were run before your three sim commits and not re-run.

**1. High. The typist deadlocks on a capital typed while Shift is being released.** `src/sim/typist.ts:105-109` (110-113 at fd8ec20). `holdingShift` is set true even when `keyDown('ShiftLeft')` returns null because the previous Shift finger is still lifting.
- **Scenario:** type a capital and let the queue empty; Shift lifts 112–126 ms later. Enqueue another capital inside that 14 ms window. The head of the queue waits forever for the cradle to rise, and everything behind it is stuck.
- **Demonstrated** (`<scratch>/review/exp2_shift_deadlock.ts`): enqueueing at 112.25–124.75 ms leaves 2 strokes pending after 3 s with only "A" printed; outside the window it prints "ABc". A random-timing fuzz (`<scratch>/review/exp10_fuzz.ts`) stalled in 3 of 40 trials with capitals and 0 of 30 without.
- **Fix:** set `holdingShift` only when `keyDown` returns a finger, and retry on the next tick.

**2. Medium. The line lock is an input filter, not a mechanism.** `src/sim/machine.ts:185`. At the right margin `makeFinger` returns null. The comment says "a bar blocks the character keys", but no body or constraint exists and the key never moves. It is absent from physics.md §3 latches and §7 limits.
- **Read only.** The repo test asserts just `keyDown === null`.
- **Fix:** add a real stop on the universal bar or key levers, enabled by carriage position, or list it in §7.

**3. Medium. Snapshots miss state, so "bit for bit" (physics.md §6) is false.** `src/sim/machine.ts:356-400`. Demonstrated with `<scratch>/review/exp7_snapshot.ts` and `<scratch>/review/exp7b_snapshot.ts`:
- **Impact tracking** (`peak`, `peakState`, `approach`) is not saved. A snapshot taken mid-impact after the peak replays as 41.2 N at 0.004 m/s; the original was 87.7 N at 4.14 m/s.
- **Group sleep state** is not saved; restore wakes every group. After any carriage return the friction-parked platen creeps, and mark `v` changed from 0.029664224664285005 to 0.029664185268633014.
- **A finger holding a key at line end** is dropped on restore by the line-lock check (`KeyK:hold` became none).
- The repo tests only snapshot a fresh machine with the bar in flight.
- **Fix:** save the impact tracking and each group's awake/quiet state, and skip the lock check when re-creating fingers.

**4. Low. The machine never idles at column 66.** `src/sim/machine.ts:164-171`. `inBellZone()` covers the armed carriage resting one column before the bell, so the bell group never sleeps.
- **Demonstrated** (`<scratch>/review/exp3_bell.ts`): after 56 letters `idle` stays false with [bell] awake and `settle` ran to its 30 s limit; 55 or 57 letters idle normally.
- **Fix:** let the bell group sleep when hammer and carriage are at rest.

**5. Low, obsolete after your removal. The shift lock could never latch** (`mechanism.ts:217`, `machine.ts:267`). Demonstrated: the lever stops at 0.09209 rad against a lock bound of 0.09407, even at 40 N.

**6. Low. Doc and test gaps.**
- **Link error.** physics.md §1 says under 6 µm. The test checks one key against 10 µm using `Rod.value`, which is the error before the solve. Measured (`<scratch>/review/exp9c_links.ts`): before the solve it is 7.5 µm at 3.2 N and 11.9 µm at 6 N. After the solve the train links are 3.3–5.1 µm, but the ribbon links reach 16–22 µm and are untested.
- **Weak tests.** The two mainspring energy tests compare released energy with force × distance, which holds whatever moved the carriage. "Work in equals energy stored" asserts only a 0.25–1× band. The bell test allows ±1 column.
- **Missing tests.** No solver test covers `PointPlane`, `PointCylinder`, a body with a parent, or two-body restitution. Nothing covers enqueue timing or snapshots after a return.
- **Reordering.** `typist.ts:85-90` pulls a queued return ahead of characters typed before it at a full line, so the line break moves. Read only; the comment marks it as intended.
- **Fix:** assert post-solve residuals for every rod across keys and touches, and add closed-form tests for the contact elements.

**Checked and found correct**
- **Jacobians:** every constraint against finite differences on random parent chains, including a plane on a moving body and shared ancestors; worst error 2.4e-8.
- **Solver:** gravity force equals −dV/dq; two-body restitution matches the closed form for mass ratios up to 870:1 and e from 0 to 1; pendulum energy drift 0.008%. Projection and unilateral clamping across both iterations read correctly.
- **Escapement:** `holdLoose`/`holdFixed` are consistent with the tooth, ratchet and dog-stop constraints (read).
- **Doc §4–5 numbers reproduce:** 47.4 / 52.4 / 55.0 / 91.6 / 110.6 ms, 4.14 m/s, 87.7 N, 47.6 / 22.7 / 22.2 mJ.
- **Keys:** all 44 at 1, 3.2 and 6 N give one mark, one space and a return to idle. Sleep snaps a bar by at most 5e-4 rad.
- **Carriage:** returns from 0–65 columns, line spacing 1–3 and 20 consecutive returns all land correctly.
- **Bell:** rings once on reaching column 67 at every touch, and again after backspacing past it.
- **View:** `rig.sync()` uses body frames. `.pose` is set only for the pinion, drum and ribbon spools, as functions of `carriage.q` or `wheel.q`. `src/ui/replay.ts` writes recorded `q` into bodies while paused and restores them afterwards.

**Not checked**
- Overlapping `keyDown` calls that bypass the typist, and a key already in flight when the lock engages.
- Wheel Coulomb friction stability; by reading, h·f/(I·ε) ≈ 6, which suggests chatter.
- Your three later sim commits.

## Findings and disposition

Dispositions are the owner agent's. Test names are in `tests/`.

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Typist deadlocks when a capital is asked for while the Shift finger is lifting (report item 1) | Accepted. Reproduced: without the fix the sweep stalls at 112 ms and the fuzz at trial 6. | `holdingShift` is set only when `keyDown` returns a finger. Tests "a capital typed at any moment after another one is printed, including while Shift is lifting" and "input arriving at random moments is never dropped, reordered or stalled". |
| F1 | Line lock is an input filter, not a mechanism (item 2) | Accepted, and repaired as a mechanism instead of being listed as a limit, because the owner asked for a machine whose every behaviour can be examined. | A lock comb (one sliding body) under the key levers, pushed by a lug on the carriage through a buffer spring; a tooth under each lever, or the lever in its slot against the comb, switched from positions; the space bar stopped by a finger on the comb's post. `makeFinger` refuses nothing. Drawn in the model, explained in the parts card and in a new tour step. Tests "the line lock is a stop in the machine…", "a key that is down in its slot holds the lock comb off…", "the bell rings once, eight columns before the end of the line…". |
| F2 | Snapshots miss impact tracking and group rest state, and drop a finger held at the line end (item 3) | Accepted. | Snapshot now also holds the tracked impact, each group's rest state, the contact state of the last substep, the event detectors' memory and the lock latches; fingers are re-created with no check. Test "snapshots are complete at awkward moments…" (nine moments); removing any of seven saved items in turn makes it fail. |
| F3 | Machine never idles with the carriage one column before the bell (item 4) | Accepted. | The bell group rests when hammer and carriage are at rest, also part-cocked on the cam. Test "the machine comes to rest at every column of the line, including on the bell cam". |
| F4 | Shift lock could never latch (item 5) | Obsolete: the unused latch was removed in `3dce49e`, before the report arrived. | None. |
| F5 | Link-error claim and test use the value before the solve; ribbon links untested (item 6, first point) | Accepted. | Ribbon links are solved last in each pass. Measured after the solve over 7 keys and 2 to 9 N: train links at most 4.4 µm, ribbon links at most 14.2 µm. The test now measures the distance between the pins after the solve (bounds 6 µm and 20 µm), and physics.md states these numbers. The ribbon links' residual was not reduced further; it is recorded in physics.md §1. |
| F6 | Weak tests: mainspring energy, "work in equals energy stored", bell ±1 column (item 6, second point) | Accepted. | The energy test compares the same stroke with the mainspring let down (finger work within 1%, same blow, no spacing); the solver test is an energy ledger to 0.2%; the bell test asserts the exact column. |
| F7 | Missing tests: point-plane, point-cylinder, bodies with parents, two-body restitution; enqueue timing; snapshots after a return (item 6, third point) | Accepted. | Solver tests "gradients of rod, point-plane and point-cylinder constraints match finite differences on chains of bodies" and "two bodies colliding…"; enqueue timing under F0; snapshots under F2. |
| F8 | A queued return is taken ahead of characters waiting at a full line (item 6, fourth point) | Rejected as a defect, kept as designed: at a full line the return is the only thing that can free the waiting characters, and they then print in their own order on the new line. | None. The comment in `typist.ts` states it. |
| F9 | Wheel dry friction may chatter (not checked by the reviewer) | Accepted as a risk. | Dry friction is now a clamp that cannot reverse a body and holds it still below the friction force. Solver test "dry friction: holds a body still below the friction force, and stops a sliding one for good". |
| F10 | Not checked: `keyDown` calls that bypass the typist; a key in flight when the lock engages | Partly addressed. | A key down in its slot when the carriage arrives holds the comb off until it rises (test under F1). Direct `keyDown` calls remain unguarded: two typebars can be thrown at once and cannot clash, which physics.md §7 lists. |
| F11 | Backspace moved the carriage two columns from column 72 on at 4.5 N, and everywhere at 6 N. Found by the owner agent while testing the F1 repair, not by the reviewer. | Accepted. The carriage coasted past the pawl; the old test tried one column and one force. | The pawl is wedged at the bottom of its stroke (`backWedge`). Test "backspace moves the carriage exactly one column wherever it stands and however firmly it is pressed" (4 columns × 4 forces × tapped or held). |
| F12 | A guided (slow) finger pushed with whatever force its depth implied, hundreds of newtons against a locked key. Found by the owner agent. | Accepted. | A guided finger stops advancing above 10 N; it settles at about 11 N on a locked key. Checked inside the F1 test. |
| F13 | Status line read "column 66 of 65" at the end of a line. Found by the owner agent in the browser. | Accepted. | Reads "full (65 columns)". Checked in the browser. |
| F14 | With a capital as the last letter of a full line, the typist kept Shift held while it waited, so the machine never came to rest. Found by the owner agent. | Accepted. | The typist lets go of Shift at a full line once the last capital has left the paper. Test "capitals waiting at a full line: Shift is let go, the machine rests, and they print after the return". |

## Verification

Run on the repaired tree: `npm run check` (type check and 39 tests, all passing), `npm run build`, `scripts/smoke.sh` (real key events print the expected text, no console errors), `scripts/walk-tour.sh` (all 17 steps finish, no console errors), and a real-keyboard run past the right margin in a headless browser (65 columns printed, 8 keystrokes waiting, comb 2.03 mm over, then `Enter` and the rest on the next line). The new tour step and the comb were looked at rendered at 1920×1080 from the three tour viewpoints and from two others.

Bounds. Timing could not be measured cleanly: other work was loading the machine, and the smoke check reported 0.77 to 0.92 of real time during a typing burst against 1.00 when the tour was first built. A Node benchmark puts the comb's share of the solve at about 2%. The reviewer's own experiment scripts were not re-run; the repository tests stand in for them. Sound was not listened to.

## Round outcome

No error found in the solver's mathematics. One high finding (F0) and two medium ones (F1, F2) repaired with tests that fail without the repair; low findings repaired or recorded. F8 is kept as designed. The repairs, in particular the lock comb and the backspace wedge, are new mechanism code that this round did not see: they go to round 1.
