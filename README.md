# Typewriter

A manual typewriter you can type on and take apart, in the browser. The 3D model is driven by a physical simulation of the mechanism, not by animation: you press a key, a finger pushes a lever, wire links pull a typebar, the type face hits the paper, and an escapement lets a spring pull the carriage one space.

It is built for learning how the machine works. You can make the body glass, isolate one mechanism, explode the parts, slice the machine open, slow time down to 1/500, pause and scrub back through the last few seconds, and follow a guided tour that explains one keystroke step by step.

## Run it

Node 24.

```bash
npm install
npm run dev
```

Open the address it prints (http://127.0.0.1:5173). `npm run build` type-checks and writes the site to `dist/`; `npm test` runs the physics tests.

## Using it

- **Type.** Letters, digits and punctuation print; `Shift` gives the upper character; `Space`, `Backspace` and `Enter` (carriage return) work as on the machine. Clicking a key, the space bar or the return lever in the 3D view does the same.
- **Guided tour** (top left) walks through the machine in 17 steps. Each step runs the real simulation in slow motion and stops at the moment it is about. `Again` replays a step; `Esc` leaves the tour and gives you your page back.
- **Look inside** (right): body solid, glass or off; focus on one mechanism (the rest turns to a faint ghost); exploded view; slice; colour parts by the job they do; labels; instruments (a chart of the last keystroke and an energy ledger); forces (arrows for the finger's push, the pull in each link, the blow on the paper, the spring and the load on the escapement dog, as the solver computes them); camera views.
- **Time** (bottom): pause, step one millisecond, slow motion. While paused, the replay bar scrubs back through the last six seconds of motion in whatever view you choose.
- **Click any part** to read what it is and how it works. On a key lever, `Press slowly` lets you push the key by hand.
- **Touch** sets how hard the fingers strike. A lighter touch prints fainter letters.

| Key | Action |
| --- | --- |
| `` ` `` | Pause or resume |
| `\` | Toggle slow motion (1/20) |
| `↑` `↓` | Faster / slower |
| `←` `→` | While paused: scrub the replay / step 1 ms |
| `Esc` | Leave the tour, or deselect a part |

The end of a line behaves like the real thing: a bell rings eight spaces before the right margin, and at the margin the keys lock. The lock is a part you can look at: a comb under the key levers that the carriage pushes sideways, so a key goes down a couple of millimetres, meets a tooth and stops. Whatever you typed past the margin waits; press `Enter` and it continues on the next line. `Auto return` does that for you.

## What is simulated

Every moving part is a rigid body with one degree of freedom (a hinge or a slide). Wire links, stops, cams, ratchets and contacts are constraints solved every 25 microseconds, so pivots and links stay rigid by construction and each link carries a force you can read. See [docs/physics.md](docs/physics.md) for the model, its numbers and its limits.

- **Type action** for all 44 keys: key lever, key link, sub-lever, draw link and typebar as separate bodies, with return spring, felt rest and down-stop. The type slug hits a rubber platen modelled as an elastic contact; the blow lasts about a third of a millisecond and peaks at about 88 N.
- **Universal bar and ribbon**: the typebar pushes the universal bar, which lifts the ribbon vibrator through a small crank.
- **Escapement**: rocker with a fixed dog and a sliding loose dog, a 16-tooth escape wheel, pinion and rack with a one-way ratchet, a retaining pawl.
- **Carriage**: 1.3 kg on rails, pulled by a mainspring through a draw band; margin stops; bell hammer cocked and released by a cam.
- **Line lock**: a slotted comb under the key levers, pushed 2 mm sideways by the carriage through a buffer spring over the last step of the line, so that its teeth stand under the levers; a key still down in its slot holds it off until it comes up.
- **Shift** lifts the platen cradle 6.8 mm through a pivoted frame. **Space bar** trips the escapement directly. **Backspace** pushes the rack back a little more than one tooth and is wedged there, so the carriage settles exactly one column back.
- **Carriage return lever**: pawl, 24-tooth line ratchet with spring detent and overthrow stop, then the same push returns the carriage and rewinds the spring.
- **Ink**: each mark is placed where the type face actually met the paper (carriage, platen and shift positions at the instant of peak pressure) and is as dark as the blow was hard. No ribbon lifted means no ink.
- **Fingers and hand** are bodies too: keys only move because something pushes them.

A typist layer queues what you type and strikes each key as soon as the machine can take it, so fast typing never loses a letter. It keeps the rhythm a trained typist keeps: one type on its way to the paper at a time.

## What is simplified

- The frame, paper and ribbon do not flex. The paper follows the platen without slipping.
- Typebars cannot collide with each other; the typist layer prevents the situation instead of simulating a jam.
- The ratchets' tooth pick-up, the bell's one-way trip, and whether a tooth of the lock comb is beside a key lever or under it, are discrete latches driven by the simulated positions, not contact geometry.
- A burst of very fast continuous typing runs at about real time on a desktop CPU with little to spare; on a slower machine the picture falls a little behind and the status line says so.
- Sound is synthesised from contact events and their strength. It is not a physical model of the sound.
- The machine is a generic mid-century desktop design with carriage shift, not a copy of a particular model.

## Layout

```
src/sim/      physics: solver, geometry, mechanism, fingers, typist (no browser needed)
src/view/     three.js model built from the same geometry, view modes, paper and ink
src/ui/       panels, input, replay, instruments, sound, guided tour
tests/        solver against closed-form mechanics; keystroke and typing behaviour
docs/         physics notes, devlog, lessons
```

## Checks

`npm run check` runs the type check and the tests. `scripts/smoke.sh` checks the browser path from real key events to ink on the page (it needs the dev server and the Playwright CLI; see the script's header). The tests cover the solver against closed-form results (pendulum period, restitution, two-body collision, dry friction, spring-damper impact, an energy ledger) and its constraint gradients against numerical derivatives, and the machine for causal order of a keystroke, rigid link closure, energy bookkeeping, part-removal counterfactuals, timestep convergence, exact replay from snapshots taken at awkward moments, and typing behaviour (no lost input, margins, bell, line lock, backspace, line feed, shift). `scripts/walk-tour.sh` walks the guided tour and saves a screenshot of every step.
