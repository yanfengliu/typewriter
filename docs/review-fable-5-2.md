# Review record: physics and tests on `fable_5_2`

This record follows the fleet's review format (`../fleet/docs/work-docs.md`) but is not filed under `docs/work/`. The allocator refuses this branch: `node scripts/work-docs.mjs check --repo ../typewriter` answers "Local reservation witness contradicts registry.json", because `fable_5_2` was started empty and does not carry the registry that `main` has. Nothing was created or changed to get past that. When the owner decides how this branch relates to `main`, this file can be moved into an allocated folder as `plan.md` plus `reviews/0_implementation.md`, `reviews/1_implementation.md` and `reviews/2_implementation.md`.

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

# Review 1: implementation

## Target

Repository `typewriter`, branch `fable_5_2`, commit `471713e` (the round 0 repairs; base `a84edde`): the line lock, the backspace wedge, snapshots, dry friction, the new tests, and the numbers in `docs/physics.md`. While the review ran, the branch moved to `2c71a62`, a fleet canon sync that changes `AGENTS.md` only.

## Reviewers and coverage

One reviewer: a Claude subagent on the Opus model, started with a fresh context and no part in writing the code, working read-only (its mutation runs used a `git archive` copy outside the repository). Lens: do the round 0 repairs hold, and what is wrong with the new mechanism code. Not covered, by its own account: the view and interface, speed, timestep convergence, a guided (slow) backspace, snapshot moments outside its four scenarios. No reviewer from a second model family took part.

## Reports

### Claude subagent on Opus (fresh context)

Unchanged, except that its experiment scripts are named as it named them (`e2` to `e15` in its scratch folder); they were not kept.

**Review of 471713e (round 1)**

I found two Medium and two Low defects in the new code, plus one serious pre-existing defect; the snapshots held up and the documented numbers match. While I was working, `fable_5_2` moved to 2c71a62. That commit changes only AGENTS.md, so `src/`, `tests/` and `docs/` are identical to 471713e and everything below applies to it. My scripts (e2–e15) are in the scratchpad folder `review2/`. Mutation runs used a `git archive` copy there, never the repository.

**Medium**

1. **The line lock can be defeated by input that arrives just before the carriage reaches the margin.** The escapement then trips against the margin stop, the dog ends a tooth ahead, and the next line starts in column 11. Code: `src/sim/machine.ts:314-329` (lockLogic), `src/sim/mechanism.ts:255`.
   - **Space bar:** `placeCarriage(74)`, `keyDown('KeyA')`, then `keyDown('Space', {force: 2.2})` 55–90 ms later. The carriage ends at 75 with `toothLoose - ratchet = 76` at 8 of 17 delays (e10).
   - **A letter:** struck 30–70 ms after the last one, it does the same and prints at 74.6–75.0 (e3). Below about 55 ms this overlaps the documented typebar-clash limit.
   - **Hold plus backspace:** J held on the lock at 3.2 N, then Backspace, prints `j@74.007`, then `j@75.000` at ink 0.33, and leaves the dog at 76 (e2, e4).
   - **Consequence:** after a return, the next letter printed at column 11.007. I checked this for the letter case and the hold case.
   - physics.md §3 names exactly this outcome as the reason for the space lock; §7 does not list the gap.
   - The typist never strikes in this window: 70 random trials at the margin were clean. Only direct `keyDown` reaches it.
   - The hold case comes from older behaviour: a key held for 1 s mid-line at 3.2 N spaces three columns and prints a second j one column on (ink 0.35). a84edde does the same.

2. **The comb is yanked when `lockBlock` is switched on while already violated.** `machine.ts:328` enables it with its bound at `LOCK_ENGAGE - 2e-5` (`mechanism.ts:196`), but `lineLockIn` tests `> LOCK_ENGAGE` (`machine.ts:134`).
   - **Scenario:** carriage at 75, a key held on the tooth (3.2 N, 8 N or a guided finger), then a return or a backspace. As the comb recedes, the lock lets go and the lever drops into its slot.
   - **Printed:** "lockBlock on at 124.97 ms, comb before 0.3990 mm -> after 0.3800 mm, comb v -0.760 m/s". With a backspace it is -0.743 m/s.
   - That is about 7 mJ injected in one substep. For comparison, the comb reaches 0.153 m/s when the carriage pushes it in and 0.036 m/s when it springs back.
   - **Fix:** enable it only when `lockBar.q <= bound`.

**Low**

3. **A backspace pressed while the carriage is still stepping is lost (moves 0 columns).** Code: `backLatch = carriage.q` at `mechanism.ts:344`, wedge at `mechanism.ts:280-284`.
   - **Scenario:** a letter at column 40, then `keyDown('Backspace')` 74–80 ms later, with the carriage 0.26–0.49 of a column into its step. It ends at 41.
   - **Rate:** 1–5 of 161 delays at each of 4.5, 7 and 10 N; the same at column 74 (e7b, e7c).
   - **Cause, from a trace:** the latch is taken at 40.714. The loose dog's spring drives the wheel back with the carriage as far as the retaining pawl (39.945). The wedge stops the carriage at 39.298, only 0.65 of a tooth behind the wheel, so the pinion ratchet never clicks.
   - It never moves 2 columns now; a84edde moved 2–4 columns in most of the same runs. The typist cannot trigger this.

4. **The platen can come to rest where its group never sleeps.** The new friction clamp (`solver.ts:340-344`) holds the platen anywhere with |sin 24q| <= 0.0833, but `isQuiet('feed')` (`machine.ts:186`) requires less than 0.08.
   - 198 returns (every column, line spacing 1–3) all came to rest. The worst resting value was 0.0759 (a blank line at spacing 3); at spacing 1 it was 0.069.
   - I could make the machine never rest only by pressing New sheet during a return: the feed group was still awake after 10 s, |sin| 0.0815, platen speed 0. a84edde comes to rest in that run. So this is latent.

**Pre-existing, High (not from this commit)**

Pressing New sheet during a carriage return sets `platen.q = 0` while the line pawl is still engaged (`machine.ts:240`; the latch is kept from `mechanism.ts:339`). The platen is flung at 2·10³ to 5·10⁴ rad/s and ends tens of thousands of lines off. a84edde behaves the same, and the button (`ui.ts:192`) can be pressed at any time.

**Tests (item 5)**, on the scratch copy:
- Wedge removed: the backspace test goes red ("from column 40 with 7 N: now at 38.000").
- `lockBlock` never enabled: "holds the lock comb off" goes red.
- Per-key lock latch not restored: the snapshot tests stay green. This is harmless — `lockLogic` recomputes the latch from positions before the next solve, so no test could catch it.
- Extra mutations: held-dog memory not restored, red; fingertip contact not restored, red (one of the seven items the doc lists); the old bell rest rule, "rest at every column" red.

**Checked and found correct**
- **Snapshots:** a harness comparing an exact digest of the state after every step replayed 772 snapshots for 100 ms each, with no divergence. The four scenarios were:
  - the comb held off by a key in its slot, then released;
  - backspaces with the wedge in, and mid-step;
  - keys and space held while arriving at the margin, then a return;
  - two key trains falling asleep.
  The same harness flags a deliberately broken restore in 17 of 35 replays.
- **Typist at the margin:** three overfull lines, auto return over 150 letters, capitals, space, backspace, a backspace queued behind waiting letters, and 70 random-timing trials. Nothing was lost, doubled, printed outside columns 10–74 or between columns; no stalls; the machine always came to rest.
- **Lock:** J and K pressed together at 75 are both stopped. At 74 both print and the carriage moves one space. No lever kick when a tooth engages (at most 0.02 rad/s).
- **Backspace from rest:** 12 columns (including 10, 66–68, 74 and 75), 2.6–16 N, tapped or held. It always moves the right amount and the key comes back up. The force needed runs from 3.2 N at column 11 to 2.6 N at 75, matching "about 3 N".
- **Docs (item 6):** every number I measured matches.
  - Keystroke timeline (§5): 47.4 / 52.4 / 54.8 / 91.6 / 110.4 ms, 4.14 m/s, 88.1 N, 47.6 / 22.7 / 22.2 mJ.
  - At the margin: key top 2.66 mm, typebar 19.7°, tooth load 20.9 N with a 4 N push held.
  - Link error after the solve: 4.44 µm on the key trains, 14.18 µm on the ribbon links.
  - Lock constants: comb rest 2.012 mm, lever stop 0.619°.
- **Gate:** `npm run check` passes, 39 of 39.

**Not checked:** the view and interface, speed, timestep convergence, a guided (slow) backspace, and snapshot moments outside the four scenarios.

Reviewed commit: 471713e (HEAD is now 2c71a62, AGENTS.md only). `git status --short`: empty.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F15 | The line lock can be beaten by a key or the space bar already on its way down as the carriage takes its last step; the escapement is then tripped against the margin stop and the next line starts one column in (report item 1) | Accepted as real, not repaired, recorded as a limit. It needs keys pressed directly: the typist layer waits for the lock before pressing anything, which the reviewer confirmed over 70 random trials. One repair was tried and backed out: stopping the carriage 0.4 of a space short of the last tooth, so that a dog let out and back in would find the same tooth. It failed in 4 of 34 timings, because the escape wheel is driven through a one-way ratchet and coasts on to the dog when the carriage stops; it also made every ordinary return land one column in until the return was changed to push further. A sound repair needs either an interlock on the escapement rocker over the whole last step or a carriage that can run on past the margin, each a new mechanism. | `docs/physics.md` §7 states the limit, its cause and why the short stop does not cure it; §3 points to it. Open for the owner to weigh. |
| F16 | The comb is thrown back at 0.76 m/s when its stop against a lever is switched on already violated (item 2) | Accepted. | The stop catches the comb where it stands (its position is set when it is switched on), it is no longer in the group's list, and it is saved in snapshots. Commit `595d48b`. Test "a key held on a tooth drops into its slot as the comb leaves, without throwing the comb": 0.760 m/s before, under 0.2 m/s now. |
| F17 | A backspace begun while the carriage is still stepping can be lost (item 3) | Accepted as real, not repaired, recorded as a limit: only a direct `keyDown` can do it (the typist layer waits for the carriage to settle), and the outcome is no movement instead of the 2 to 4 columns of the old code. | `docs/physics.md` §7. |
| F18 | The feed group's rest rule was stricter than the friction that holds the platen, so the machine could fail to come to rest (item 4) | Accepted. | The platen may rest wherever friction holds it against the detent. Commit `595d48b`. Test "the platen may rest anywhere its friction holds it against the detent…". |
| F19 | Pressing New sheet during a carriage return flings the platen (pre-existing, High) | Accepted. It can be reached from the interface. | New sheet renumbers the platen angle by whole lines together with the pawl's latch and any impact being tracked, and touches nothing else. Commit `595d48b`. Test "a new sheet can be fed at any moment…": 3,682 rad/s before, a normal line feed now. |
| F20 | A key struck and held with a weak steady force lets the carriage step repeatedly (noted under item 1 as older behaviour; measured afterwards by the owner agent: up to 14 steps in 2 s at 2.6 N) | Accepted as real, not repaired, recorded as a limit: the type action has less friction than a real one, and only a held `keyDown` does this. Raising that friction would move every calibrated keystroke number. | `docs/physics.md` §7. |

The reviewer's note that the per-key lock latch need not be saved is right; it is still saved, which costs nothing.

## Verification

On `595d48b`: `npm run check` (type check and 42 tests, all passing) and `npm run build`. The three new tests each fail on `471713e` (comb at 0.760 m/s; platen at 3,682 rad/s; rest rule). The reviewer's own scripts were not re-run; its scenarios for F16, F18 and F19 are the ones the new tests use. Browser checks for this round (the New sheet button pressed during a return, the smoke check and the tour walk) are recorded in the devlog entry of the commit that follows this one.

## Round outcome

The round 0 repairs hold: snapshots replayed exactly in 772 trials, backspace is right from rest over twelve columns and 2.6 to 16 N, the typist loses nothing at the margin, and every documented number was reproduced. Three defects are repaired with tests (F16, F18, F19, the last a serious older bug reachable from the New sheet button). Three are real and left as recorded limits because they need keys pressed directly, outside what the typist layer does (F15, F17, F20); F15 is the one worth the owner's attention, since a cure means a further interlock. The repairs in `595d48b` are small and were not sent to a third round.

# After round 1: the owner asked for the interlock (F15)

This is a labelled later change, not part of the closed round above. Told of F15, the owner chose to have the interlock built.

## What was built

A trip lock on the escapement itself: commit `44dc5ee` (simulation and tests), `7948776` (the two parts drawn, parts cards, `docs/physics.md`), `c980360` (a tour step). A tab under the carriage's rear member moves in behind a finger on the dog rocker's shaft once the carriage is 0.15 mm into its last step. From then on the rocker can swing 0.05 rad, where the fixed dog needs 0.079 rad to enter the wheel. A stroke that got past the comb ends with its typebar against the universal bar, 11° short of the paper. If the rocker is still swung out when the tab arrives, the finger stands in the tab's way and the carriage waits. The two stops are switched from positions and placed where the part stands when switched on, the same way as the comb's after F16, and are saved in snapshots.

## Findings and disposition (continued)

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F15 | (as in round 1) | Now repaired, at the owner's request. | Trip lock, `44dc5ee`. A space or a letter pressed 20 to 100 ms after the last letter of a line: 0 of 34 timings shift the next line (before: 8 of 17 for the space bar, more for a letter) and nothing extra prints. Pressed 0 to 20 ms after it (two typebars at the paper together), the second letter prints on top of the first as it does anywhere on the line, and the next line still starts in the first column in all 22 timings. A key struck with 3.2 to 14 N past a held-off comb stops at 88.6 to 88.9° of 100 with the rocker at its limit. Tests "a stroke that slips past the comb during the last step cannot trip the escapement or shift the next line", "a key that gets past the comb is stopped at the universal bar, however hard it is struck", "if the rocker is still swung out when the tab arrives, the carriage waits for it"; all three fail with the lock switched off. |
| F21 | A key struck while the carriage is being returned prints on the fly and leaves the next line one column in. Found by the owner agent while testing the trip lock: struck 60 to 180 ms into a return from column 40, the next letter landed in column 11. It is the cause of F15 acting where the trip lock cannot reach: the escapement is tripped while the wheel stands still. | Accepted as real, not repaired, recorded as a limit: only a direct `keyDown` during `returnCarriage` does it. The typist layer presses nothing until the return is over, and holds a return back while any finger is on a key. | `docs/physics.md` §7. |

## Verification

On `c980360`: `npm run check` (type check and 45 tests, all passing) and `npm run build`. In a headless browser at 1920×1080: `scripts/smoke.sh` (text right, no console errors, 0.99 of real time at 212 frames a second on a lightly loaded machine); `scripts/walk-tour.sh` (all 18 steps finish, no console errors); the finger and tab looked at with the carriage at the margin, two columns before it, and with Shift held and the rocker fully swung; the finger's clearances computed over the rocker's whole swing (shift rail 1.6 mm with Shift down, bell cam 1.6 mm, rack 5.6 mm). One tour walk stalled at step 17 while the test suite and the build were running at the same time on the machine; it did not recur in two walks run alone, and its cause was not found.

The trip lock was new mechanism code that no reviewer had seen when this was written. It was reviewed afterwards: Review 2 below.

# Review 2: implementation (the trip lock)

## Target

Repository `typewriter`, branch `fable_5_2`, commit `c980360`: the trip lock added in `44dc5ee` (`TRIP_LOCK` in `src/sim/layout.ts`; `tripLock`, `tripBlock` and `cTrip` in `src/sim/mechanism.ts`; `lockLogic`, the fingers' landing rules, the knock report, snapshots and `placeCarriage` in `src/sim/machine.ts`), its three tests, and its numbers in `docs/physics.md`. While the review ran the branch moved to `3656f6f`; the two commits in between change documentation only.

## Reviewers and coverage

One reviewer: a Claude subagent on the Opus model, started with a fresh context and no part in writing the code, working read-only (its mutation runs used a `git archive` copy outside the repository). Lens: any input timing at the end of a line that still shifts the next line, prints past the margin or trips the escapement past the trip point; the two switched stops; the lock acting where it should not; snapshots; whether the tests can fail; whether the documented numbers hold. Not covered, by its own account: the 3D view, interface and tour; the type check and build; its substep hunt below 24 N and for keys other than B; backspace with a guided finger; speed. No reviewer from a second model family took part.

## Reports

### Claude subagent on Opus (fresh context)

Unchanged, except that the absolute path of its scratch folder is shortened to `<scratch>/review3/`. Its scripts were not kept; the repository tests named under "Findings and disposition" reproduce the findings.

**Trip lock review of c980360**

I reviewed commit c980360. HEAD has since moved to 3656f6f, but nothing in src/ or tests/ changed (`git diff c980360 HEAD -- src tests` is empty). Scripts and outputs are in `<scratch>/review3/` (a.ts to g.ts and the *.out files). I found no High findings.

**Medium**

1. **In one substep both stops can be off, and a hard blow then trips the escapement past cTrip.** If the key is held, the next line starts in column 11. The code is `src/sim/machine.ts:362-363`.
   - Line 362 only lets the tab in if the rocker is at most 0.052 rad. Line 363 only lets the finger block while the carriage is short of cTrip.
   - Suppose that in the one 25 µs substep where the carriage crosses cTrip, the rocker swings from ≤0.05 to >0.052. Then the next `lockLogic` turns on neither stop, and the tab stays out until the rocker comes back under 0.052.
   - How far the rocker moves per substep as it passes 0.05 rad: 0.66 mrad at 3.2 N, 1.42 mrad at 14 N, 2.15 mrad at 30 N, 2.8 mrad at 50 N. So the hole needs a key struck with about 25 N or more.
   - Reproduction, plain API: `placeCarriage(74); advance(0.05); keyDown('KeyA'); advance(2130*25e-6); keyDown('KeyB',{force:57,hold:true}); advance(0.05); keyUp('KeyB')`, then run to rest. This gives 3 trip events, `b@74.071` followed by fading b's at 74.38–74.92, and the dog holding tooth 76. After `returnCarriage()`, Z prints at column 11.007. The same happens at 60 N after 2141 substeps.
   - If the key is let go, or held at 32–52 N, the escapement still trips at column 74.063–74.064 (cTrip is 74.059) and b prints at 74.07 over the a, but the next line is correct.
   - The hunt in c.ts bisected the delay one substep at a time for each force from 24 to 60 N. It found the coincident substep at 34 forces; at 8 of them the rocker was 2.01–2.55 mrad past.
   - Only a direct `keyDown` can reach this: the typist waits for the comb, and the UI's touch slider stops at 6 N. It still contradicts "nothing can trip the escapement at the end of the line", the test name "however hard it is struck" and §7's "in every timing tried".
   - **Candidate fix** (tried by patching `lockLogic` in memory): put the tab in whenever the carriage is past cTrip, whatever the rocker angle. All 16 cases (8 forces, let go and held) then end normally, with the rocker at most 2.55 mrad past the stop and rebounding at −9 to −13 rad/s, about 0.1 of its incoming speed. The same change on the scratch copy keeps the three trip tests and five margin tests green.

**Low**

2. **The three tests cannot see finding 1.** Results of breaking the code on a `git archive` copy:

   | Mutation | Red tests |
   |---|---|
   | Lock never on | all three (as the author claims) |
   | Finger never blocks | only "rocker is still swung out" |
   | `landed` rules removed | only "gets past the comb" |
   | Tolerance set to 0 | none |
   | Tab in whatever the rocker angle | none |
   | Finger bound fixed at cTrip | none |

3. **No snapshot test covers a trip-lock moment.** A `restore()` that skips all four trip items leaves the three snapshot tests green. In my harness, forgetting only `tripArmed` changes the event stream in 26 of 151 replays.
4. **Some documented numbers are narrower than measured once strokes are harder.**
   - §7 says the letter is lost if the space bar follows it within 4 ms. Measured, the window is 0–4.5 ms at 2.2 N, 0–13.5 ms at 8 N and 0–16 ms at 14 N.
   - §7 says a second letter overprints if struck within 14 ms. A 14 N B struck 41.8 ms after A still printed at 74.059.
   - §5 says the key goes down 92% of its travel; I measured 92.7–93.0%.
5. **Outside scope, noticed only:** at 55 N and above, a key also prints its capital glyph mid-line (at column 40, B with ink 0.96 next to b).

**Checked and correct**
- **Timing sweep:** 9 input sets × 53 delays from 0 to 120 ms (Space at 2.2 and 8 N; B at 3.2, 9 and 14 N; capitals with Shift held; B and Space held 0.4 s; B held 1 s at 2.6 N). All 477 ended at rest at 75 on tooth 75 with the tab in, nothing printed at 74.5 or beyond, and no trip past cTrip. In the 126 runs where I also returned the carriage, Z printed at 10.007.
- **Substep scans** across each boundary between "carriage waits" and "rocker locked": the stop was switched on already past its angle 9 times, by 0.13–0.56 mrad. All 9 ended normally.
- **Scenarios run** (all ended normally, and both typed pages match their text):
  - holds at column 74 (2.4–9 N);
  - weak holds starting at columns 70–73 that stop at 75;
  - backspace at the margin, then typing;
  - J held on the comb, then backspace (round 1's j at 75 and dog 76 are gone);
  - backspace 56–104 ms into the last step;
  - 20 guided space-bar and J runs, slow and oscillating;
  - an auto-return page of 225 random characters, and a page with manual returns, overfull lines and backspaces.
- **Carriage held at the finger:** the escape wheel coasts at most 0.48 mm ahead of it; it would take 3.57 mm to fool the loose dog. The carriage creeps 0.0693 mm onto the fixed dog with the key held.
- **Snapshots:** 789 snapshots, taken with the tab in, the finger in the way, the carriage on the finger, and a typebar pressing the locked universal bar. About 1.35M replayed substeps were compared on full state plus events; none diverged.
- **Numbers:** the typebar stops at 88.59–88.89°, 11.1–11.4° short of the paper; the universal bar is 2.24–2.30 mm in; the rocker is at 0.0500 rad, for 3.2–14 N. With the space bar pressing, the rocker sits up to 1.3 mrad past the stop because the space-bar contact is solved after the trip lock; this is harmless.
- **Full suite**, run once: 45 of 45 pass.

**Not checked:** the 3D view, UI and tour; tsc and build; the bisection hunt below 24 N and for keys other than B; backspace with a guided finger; speed.

`git status --short`: empty.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F22 | In the substep in which the carriage passes the trip point, a blow of 25 N or more can carry the rocker more than 2 mrad past its stop; neither stop then comes on, the escapement trips past the trip point, and with the key held the next line starts in column 11 (report item 1) | Accepted. Retested before repairing: 57 N pressed 2130 substeps after the last letter gave 3 trips, the dog on tooth 76 and the next letter at column 11.007. Only a direct `keyDown` reaches it (the interface's touch stops at 6 N), but it contradicts what the lock is for. | The tab is in whenever the carriage is past the trip point, wherever the rocker stands, as the reviewer proposed; the pair is now decided by one position, so exactly one stop can act. Commit `7ebf546`. The same press now ends with one trip, the dog on tooth 75 and the next letter at 10.007; in the tie the rocker is 2.1 mrad (57 N) and 2.5 mrad (60 N) past its stop for one substep. |
| F23 | The three trip-lock tests cannot see F22: none goes red with the tolerance set to 0 (item 2) | Accepted. The first test's check ran only while the tab was in, so it was skipped in exactly the case that matters. | New test "a hard blow that reaches the rocker in the very substep the tab arrives is caught all the same": six blows from 36 to 60 N, each timed to the substep and to the four either side; it fails on `c980360` ("57 N pressed 155 substeps on: with the carriage past the trip point the tab is in"). The first test's check is now conditioned on the carriage being past the trip point. Commit `7ebf546`. |
| F24 | No snapshot test covers a trip-lock moment (item 3) | Accepted. | Two moments added to "snapshots are complete at awkward moments…": a key pressing the universal bar against the locked rocker, and the substep in which the carriage meets the rocker's finger. With one saved item left out of the restore at a time, on a scratch copy: forgetting whether the knock has been reported fails the test ("one knock, reported once"); forgetting either switch or the place the carriage was stopped does not, because `lockLogic` works those three out again from positions before the next solve. They are still saved, which costs nothing. Commit `7ebf546`. |
| F25 | Three documented numbers are narrower than measured once strokes are harder (item 4) | Accepted. The windows depend on which typebar reaches the universal bar first, so they grow with the force of the second stroke; the first measurements used one force. | Measured again on `7ebf546` (360 timed pairs, all ending at rest on tooth 75 with the tab in and nothing printed past the last column) and `docs/physics.md` §5 and §7 corrected: the key goes down 93% of its travel (92.5% while held); a second letter prints over the last one if struck within 15 ms at 3.2 N, 34 ms at 8 N, or 8 to 41 ms after it at 14 N; the last letter is lost to a space bar pressed within 4.5 ms at 2.2 N, 13.5 ms at 8 N, 16 ms at 14 N, or to a second letter struck with 14 N within 7 ms. |
| F26 | From about 55 N a key prints its capital as well, in the middle of a line (item 5, outside the review's scope) | Accepted as real, not repaired, recorded as a limit. Measured: the platen is a linear spring and damper and nothing else stops the typebar, so at 50 N on the key the type sinks 1.4 mm into it and the other character on the slug reaches the paper (not yet at 48 N). That is eight times the hardest touch the interface offers; a stiffening platen would move every calibrated impact number. | `docs/physics.md` §7 states the range the model is checked for and what happens beyond it. |

## Verification

On `7ebf546` (the code) together with the documentation of the commit that adds this section: `npm run check` (type check and 46 tests, all passing) and `npm run build`. The new test fails on the rule of `c980360` ("57 N pressed 155 substeps on: with the carriage past the trip point the tab is in") and passes now. The reviewer's reproduction was run before and after the repair: before, 3 trips, the dog on tooth 76 and the next letter at column 11.007 (57 N held; the same at 60 N); after, 1 trip, tooth 75 and column 10.007. The snapshot test was run on a scratch copy with one saved trip-lock item left out of the restore at a time (results under F24). The corrected numbers come from 360 timed pairs and 14 single strokes on `7ebf546`. A Node benchmark of a typing burst reads 12.5 µs per solved substep, no slower than before the repair. In a headless browser at 1920×1080: `scripts/smoke.sh` twice (text right and no console errors both times; 0.82 of real time at 74 frames a second right after the build had finished, 0.99 at 230 frames a second a few minutes later); `scripts/walk-tour.sh` (all 18 steps finish, no console errors), and the picture of the trip-lock step looked at: typebar K at 88° of 100°, the rocker at 50 of the 79 mrad it takes to trip, one letter printed. The reviewer's own scripts were not re-run.

## Round outcome

The trip lock held for everything the interface can do and for strokes up to 14 N in the reviewer's 477 timings; snapshots replayed exactly in 789 trials, and its documented geometry was reproduced. Its one hole needed a blow of 25 N or more arriving within one substep of the tab; it is closed, with a test that fails without the repair (F22, F23). The snapshot test now covers the lock (F24), the documented timing windows are restated by force (F25), and a limit of the platen model at about 50 N is recorded (F26).
