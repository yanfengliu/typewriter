# Physics model

Sections: 1 Formulation · 2 Contacts · 3 The mechanism · 4 Numbers · 5 What a keystroke looks like · 6 Checks · 7 Limits.

## 1. Formulation

Every moving part is a body with one generalized coordinate `q` relative to its parent: a hinge angle about a fixed axis or a slide along a fixed direction (`src/sim/solver.ts`). A body's world frame is its parent's frame composed with that one motion, so pivots cannot drift: joint closure is exact by construction. Geometry is authored in assembly coordinates, the world positions with every `q` at zero, and the 3D model uses the same numbers (`src/sim/layout.ts`).

Each coordinate has a constant generalized inertia (kg·m² about the hinge axis, or kg). Parts carried by a moving part (the loose dog on the rocker, the platen on the cradle, the cradle on the carriage) are light or symmetric about their axis, so inertial coupling to the carrier is neglected; the carried mass is lumped into the carrier. Forces through the carried part still reach the carrier, because every constraint and force uses the full Jacobian along the parent chain.

What closes a loop between parts is a scalar constraint `C(q) = 0` (rigid wire link) or `C(q) ≥ 0` (contact, stop, tension-only wire) with a sparse gradient. Each 25 µs substep:

1. Forces: gravity, springs, damping, finger and hand forces, and the elastic contacts of section 2 give `f`; then `v += h f / m`. Dry friction on a coordinate then takes off at most `h F_f / m` of speed and never reverses it, so a body pushed with less than its friction force stays exactly still instead of creeping. Then `q += h v` (semi-implicit Euler).
2. Rigid constraints are projected at position level in two Gauss-Seidel passes: `Δλ = −C / Σ(∇C² / m)`, `q += ∇C Δλ / m`. Unilateral constraints only push (`λ ≥ 0`).
3. `v = (q − q_prev) / h`, so constraint forces enter the velocities. `λ / h²` is the force the constraint carried: the tension in a link, the load on a dog.
4. Rigid contacts get their restitution here.

This is XPBD with small steps and zero compliance. It converges to constrained rigid-body dynamics as `h → 0`. What is left after each substep's solve is what is drawn and what the next substep starts from: at 25 µs the two links of a key train end within 5 µm of their length through a full stroke, for touches up to 9 N, and the two short links of the ribbon lift within 15 µm (they are solved last in each pass, after the typebar contact that drives the universal bar; their middle body, the lift lever, is much lighter than its neighbours, which is the slow case for Gauss-Seidel).

For a point `p` on body A held on the positive side of a plane fixed to body B (normal `n`), `C = (p − p_B)·n`. Differentiating with B's hinge angle and using `C = (Rᵀ(p − o) − (p_B0 − o))·n_0` gives `∂C/∂q_B = −n·(a × (p − o))`: B's Jacobian is taken at the contact point `p`, not at the plane's anchor. Cylinders (the platen) work the same way with the radial direction as normal.

Resting parts are put to sleep in groups (a key train; the escapement with the carriage and the line lock; the shift mechanism; the space bar; backspace; the line feed; the bell). A sleeping part is frozen and skipped; when everything sleeps, time passes with no solver work. That holds at every column, including with the carriage standing on the bell cam and against the right margin.

A snapshot (`Typewriter.snapshot`) holds everything the future depends on: coordinates and speeds, the latches, each group's rest state, the contact state of the last substep (pre-step logic reads it), the impact being tracked for the ink, the event detectors' memory, where the lock comb was caught by a lever in its slot, and the fingers and hand with their programs. Restoring one and replaying the same inputs gives the same future bit for bit.

## 2. Contacts

Two kinds, chosen by what the contact has to get right.

**Rigid** (stops, the universal bar pick-up, tooth on dog): position projection plus a coefficient of restitution. Exact non-penetration, no stiffness to resolve.

**Elastic** (type face on the platen, felt pads, fingertip): a Kelvin-Voigt spring-damper `F = k·depth − c·Ċ`, never pulling, integrated explicitly with the other forces. The type-on-platen impact lasts about 0.3 ms and its peak force decides how dark the letter is, so its duration and force must be resolved, not just its outcome. Integrated implicitly through XPBD compliance, twelve substeps across the contact lose about 25% of the rebound to numerical damping; integrated explicitly the restitution matches the closed form `exp(−ζω₀t*)` to within 3% (`tests/solver.test.ts`).

**Heavy bodies stopped through light ones.** The carriage (1.3 kg) is stopped by the chain rack → pinion ratchet → escape wheel (grams) → loose dog (1.5 g) → dog stop. Gauss-Seidel passes momentum through such a chain a few percent per substep, which would let the carriage sink a fraction of a millimetre into the dog. The chain ends on the frame, so its consequence is stated directly as one more constraint: while a dog is in the wheel, the carriage cannot pass the held tooth (`holdLoose`, `holdFixed` in `src/sim/mechanism.ts`). The light parts keep their own constraints and simply follow.

## 3. The mechanism

| Group | Bodies (coordinate) | Closed by |
| --- | --- | --- |
| Key train ×44 | key lever (hinge), sub-lever (hinge), typebar (hinge) | two rigid links; felt rest; down-stop; platen contact for each of the slug's two characters; universal-bar contact |
| Universal bar, ribbon | universal bar (slide), ribbon lever (hinge), vibrator (slide) | two rigid links; stops |
| Escapement | rocker (hinge), loose dog (slide on rocker), escape wheel (hinge) | push from universal bar; tooth on loose dog; tooth on fixed dog; retaining pawl; pinion ratchet to the carriage |
| Carriage | carriage (slide), cradle (slide on carriage), platen (hinge on cradle), return lever (hinge on cradle) | mainspring force; margin stops; cradle stops; line pawl; detent; overthrow stop |
| Controls | shift frame (hinge), space frame (hinge), backspace lever (hinge), bell hammer (hinge) | shift rail under the cradle shoe; space tip under the rocker arm; backspace pawl and its wedge stop; bell cam |
| Line lock | lock comb (slide) | buffer spring from a lug on the carriage; return spring; stops; a tooth under each key lever, or the lever in its slot against the comb |
| Typist | one finger per pressed key (slide), the return hand (force) | fingertip pad contact |

The typebars pivot on a circle whose centre is the printing point, each about the tangent to that circle, so every bar swings in a plane through the printing point and arrives square to the platen. Bars at the ends of the segment see their draw link arrive from a different direction than the middle ones; each heel is clocked to stand square to its own link at mid-stroke, as on real machines, or the outer bars would reach a dead centre before the platen. The sub-lever's input arm is solved per key so that full key dip (14 mm) brings the type face exactly to the paper.

Discrete latches, set from simulated positions each substep: which dog overlaps the wheel (from the rocker angle), which tooth each dog will meet, the pinion ratchet's index, the line pawl's pick-up tooth, the backspace pawl's engagement, the bell trip's one-way arm, and for each key lever whether a tooth of the lock comb is beside it or under it.

**Line lock.** A comb lies across the machine under the key levers, 37 mm in front of their fulcrum, with a slot under every lever and its teeth 0.4 mm below the levers' lower edges. A post on the comb rises between two levers to the carriage. Over the last 2.3 mm of carriage travel a lug on the carriage meets a buffer spring on the post and pushes the comb sideways against a light return spring; with the carriage at the margin the comb rests 2.0 mm over, its teeth under the levers. A key lever can then turn 0.62°, about a fifth of the key's travel, before it stands on a tooth: the typebar rises some 20° and never reaches the universal bar, so nothing prints and the escapement is not touched. A finger on the post reaches over the rising tail of the space lever and stops the space bar at 12% of its travel, which matters: tripping the escapement with the carriage against the margin stop would leave the loose dog a tooth ahead and the next line one column out. A lever that is down in its slot when the carriage arrives stands in the comb's way (the comb is caught where it stands, at most 0.40 mm over, against the lever's side) until it comes up; the buffer spring is what lets the carriage finish its step meanwhile. Backspace is not locked. The lock therefore holds every key that is up when the carriage arrives, which is every key the typist layer will press; section 7 says what a key already on its way down can do.

**Backspace.** The pawl pushes the rack back 1.3 tooth spaces. At the bottom of the stroke it is wedged between the rack tooth and a stop on the frame, with 0.3 mm of play, so the carriage cannot coast on under its own momentum; it then settles forward onto the previous tooth. Holding the carriage back against the mainspring takes about 3 N at the key: a feebler press does not complete the stroke and the carriage returns to where it was.

Ink: while a type face is in contact, the state at peak force is kept. When the face leaves, a mark is recorded at the sheet position given by that state (carriage travel for the column; platen angle, shift height and where on the platen's circumference the face landed for the line), with darkness `cover · (1 − exp(−(F/45 N)²))`, where `cover` is the fraction of the character the lifted ribbon covered.

## 4. Numbers

| Quantity | Value | Why |
| --- | --- | --- |
| Substep | 25 µs | about 12 steps across the type impact |
| Key dip, lever angle | 14 mm, 3.1–3.9° by row | levers pivot at the back, rows at different radii |
| Typebar length, travel | 75 mm, 100° | |
| Typebar inertia, mass | 1.49×10⁻⁵ kg·m², 4.5 g | 75 mm steel bar plus slug |
| Platen contact | k = 2.5×10⁵ N/m, c = 12 N·s/m | restitution about 0.55, contact about 0.3 ms |
| Universal bar | 10 g, 4.6 mm travel, picked up 22° before the platen | |
| Trip point | type face about 10 mm from the paper | dogs swap at 3.0 mm of bar travel |
| Escape wheel | 16 teeth, 14 mm radius; pinion 16 teeth at 2.54 mm pitch | one tooth = one letter space |
| Carriage | 1.3 kg, band tension 9 N falling 10 N/m | step takes about 37 ms |
| Shift | cradle 1 kg rises 6.8 mm, 70% carried by balance springs | |
| Platen | 4 in circumference, 24 line teeth, detent 0.06 N·m | 1/6 in per line |
| Finger | 20 g, pad 3×10⁴ N/m, default push 3.2 N | a guided (slow) finger stops pressing harder at about 10 N |
| Line lock | comb 25 g; buffer 800 N/m; return 40 N/m with 0.15 N preload; slots 2 mm for 1.2 mm levers | tooth edge reaches a lever at 0.4 mm of comb travel, covers it at 1.6 mm, rests at 2.0 mm |

## 5. What a keystroke looks like

Default touch, key H, times from the finger starting to push: universal bar picked up at 47 ms; dogs swap at 52 ms; impact at 55 ms with the face arriving at 4.1 m/s and peaking near 88 N; carriage on the next tooth at 92 ms; typebar back on its rest at about 110 ms. The finger does about 48 mJ of work; the typebar arrives with about 23 mJ; the letter space releases 22 mJ from the mainspring, none of it from the finger.

At the right margin the same finger meets the line lock instead: the key top goes down 2.6 mm, the typebar rises 20°, and a 4 N push held on the key loads the tooth under the lever with about 21 N.

Because the last tenth of key travel moves the typebar 15°, holding the type against the paper takes nearly 3 N at the key. A key struck and held therefore lets the bar rebound, come back and print a fainter second image after the carriage has started to move: the shadow that typing manuals warn against, and the reason for a staccato touch. The model produces it without being told to (`tests/typing.test.ts`).

## 6. Checks

`npm test`.

- Solver against closed forms: large-angle pendulum period (2×10⁻⁴), four-bar closure (10 nm) and energy, rebound height `e²h`, spring-damper contact duration, restitution and indentation, static torque balance, and an energy ledger (work put in equals energy stored plus energy dissipated, to 0.2%). Two colliding bodies keep their momentum and separate at `e` times the approach speed, for mass ratios up to 900. Dry friction holds a body exactly still below the friction force and stops a sliding one in `v²m / 2F_f` for good.
- Constraint gradients: the stated `∂C/∂q` of rods, point-on-plane and point-on-cylinder contacts equals a numerical derivative for every body, on bodies that ride on other bodies (1620 derivatives, to 10⁻⁷).
- Keystroke: causal order of events; one mark, one space; link error after the solve under 6 µm for the key trains and 20 µm for the ribbon lift, over four keys and touches from 2 to 9 N; simulated pose equals independent loop closure; a slow press reaches the paper but does not ink; harder touch means faster, harder, darker. Energy: one letter space releases the mainspring's mean pull times the pitch (to 0.1%), and with the mainspring let down the same stroke costs the finger the same work (to 1%) and lands the same blow, so none of the spacing is paid by the finger.
- Counterfactuals: no draw link, no print and no space; typebar missing the universal bar, no ribbon lift and no space; ribbon linkage unhooked, a blow with no ink; mainspring let down, a trip with no space.
- Convergence: impact time within 1.2% and approach speed within 3% between 25 µs and 6.25 µs.
- Replay: a snapshot is taken at nine awkward moments (past the peak of an impact; the substep before, and the substep in which, a key meets the line lock; asleep after a line and a return; half-way through a return; a key held with Shift moving; standing on the bell cam; fingers pressing against the lock; a guided slow press), the machine is driven somewhere quite different, and the snapshot restored: the same inputs then give the same state bit for bit. Leaving any one saved item out of the restore (impact peak, group rest state, contact state, fingertip contact, event memory, finger work, guided depth) makes this test fail.
- Typing: bursts print in order with nothing lost at 8–20 strokes per second; repeats, shift, space, carriage return and auto return; a capital asked for at any moment after another one, and input arriving at random moments, is never dropped, reordered or stalled; light, normal and heavy touch give distinct darkness; a typist reset after a restore starts clean.
- End of the line: the bell rings once, with exactly eight columns left; the line holds exactly its width; a locked key goes down a fifth of its travel and no further, prints nothing and does not touch the escapement, and so does the space bar; a key held down in its slot holds the comb off until it comes up; the waiting letters print on the next line. The machine comes to rest at every column, including on the bell cam.
- Backspace: exactly one column from any column, for presses from 3.5 to 10 N, tapped or held; a 2 N press moves nothing for good.
- Smaller guards: a key held on a tooth while the carriage is returned or backspaced drops into its slot without the comb being thrown (it was, at 0.76 m/s, when its stop was switched on a hair out of place); a new sheet fed while the return lever is turning the platen leaves the platen alone (it used to be flung at thousands of rad/s, because the pawl's latch kept the old angle); the platen parked anywhere its friction can hold it lets the machine come to rest.

## 7. Limits

- Carried-part inertia is neglected (section 1). It matters only if a carried part were heavy and off-axis.
- No friction at contacts other than the lumped Coulomb terms on coordinates. The force needed to slide a loaded dog off its tooth is not felt at the key.
- Typebars cannot clash; the typist layer keeps one type in flight.
- The line lock's two contacts (tooth under lever, lever in the comb's way) are switched from the parts' positions, not found by contact geometry, and carry no friction: a key still being pressed against a tooth does not hold the comb when the carriage leaves the margin.
- The line lock can be beaten by a key, or the space bar, that is already on its way down while the carriage takes its last step: the comb cannot slide under a lever that is in its slot. The stroke then lands with the carriage against the right margin stop (a letter prints at or just before column 75), the escapement is tripped with nowhere for the carriage to go, and the loose dog comes back in a tooth ahead: after the return the next line starts one column to the right. Only keys pressed directly can do this (`Typewriter.keyDown` within about 90 ms of the last letter, or Press slowly held part-way while the line is finished from the keyboard); the typist layer waits for the lock before it presses anything. Moving the margin stop short of the last tooth does not cure it, because the escape wheel is driven through a one-way ratchet and coasts on to the dog when the carriage stops.
- A backspace begun while the carriage is still stepping (pressed directly, 74 to 80 ms after a letter) can be lost: the pawl takes hold of the rack in mid-step and its stroke ends short of the next ratchet click. The typist layer waits for the carriage to settle first.
- A key struck and held with a steady force below what holds the type on the paper (about 3 N) hovers near the trip point and lets the carriage step several times, up to 14 in two seconds at 2.6 N. Real linkage friction would stop that after a bounce or two; only a held `keyDown` does it, not typing.
- The fingertip is a light spring-damper. A key jabbed part of the way down by a guided finger can be thrown ahead of it and bounce on the fingertip a few times, more than real finger pulp would allow.
- Speed: a burst of continuous fast typing (two key trains and the escapement awake) costs about 21 µs of one desktop CPU core per 25 µs substep, so it runs at about real time with little to spare; ordinary typing has idle gaps, which cost nothing.
- Paper and ribbon are geometry, not bodies.
- First-order integration: in the free-swinging tests the energy error after one second is about 0.01% of the swing energy.
