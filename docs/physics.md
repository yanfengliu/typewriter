# Physics model

Sections: 1 Formulation · 2 Contacts · 3 The mechanism · 4 Numbers · 5 What a keystroke looks like · 6 Checks · 7 Limits.

## 1. Formulation

Every moving part is a body with one generalized coordinate `q` relative to its parent: a hinge angle about a fixed axis or a slide along a fixed direction (`src/sim/solver.ts`). A body's world frame is its parent's frame composed with that one motion, so pivots cannot drift: joint closure is exact by construction. Geometry is authored in assembly coordinates, the world positions with every `q` at zero, and the 3D model uses the same numbers (`src/sim/layout.ts`).

Each coordinate has a constant generalized inertia (kg·m² about the hinge axis, or kg). Parts carried by a moving part (the loose dog on the rocker, the platen on the cradle, the cradle on the carriage) are light or symmetric about their axis, so inertial coupling to the carrier is neglected; the carried mass is lumped into the carrier. Forces through the carried part still reach the carrier, because every constraint and force uses the full Jacobian along the parent chain.

What closes a loop between parts is a scalar constraint `C(q) = 0` (rigid wire link) or `C(q) ≥ 0` (contact, stop, tension-only wire) with a sparse gradient. Each 25 µs substep:

1. Forces: gravity, springs, damping, Coulomb friction, finger and hand forces, and the elastic contacts of section 2 give `f`; then `v += h f / m`, `q += h v` (semi-implicit Euler).
2. Rigid constraints are projected at position level in two Gauss-Seidel passes: `Δλ = −C / Σ(∇C² / m)`, `q += ∇C Δλ / m`. Unilateral constraints only push (`λ ≥ 0`).
3. `v = (q − q_prev) / h`, so constraint forces enter the velocities. `λ / h²` is the force the constraint carried: the tension in a link, the load on a dog.
4. Rigid contacts get their restitution here.

This is XPBD with small steps and zero compliance. It converges to constrained rigid-body dynamics as `h → 0`, and at 25 µs link-length error stays under 6 µm through a full stroke.

For a point `p` on body A held on the positive side of a plane fixed to body B (normal `n`), `C = (p − p_B)·n`. Differentiating with B's hinge angle and using `C = (Rᵀ(p − o) − (p_B0 − o))·n_0` gives `∂C/∂q_B = −n·(a × (p − o))`: B's Jacobian is taken at the contact point `p`, not at the plane's anchor. Cylinders (the platen) work the same way with the radial direction as normal.

Resting parts are put to sleep in groups (a key train, the escapement, the shift mechanism, the line feed, the bell). A sleeping part is frozen and skipped; when everything sleeps, time passes with no solver work.

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
| Controls | shift frame (hinge), space frame (hinge), backspace lever (hinge), bell hammer (hinge) | shift rail under the cradle shoe; space tip under the rocker arm; backspace pawl; bell cam |
| Typist | one finger per pressed key (slide), the return hand (force) | fingertip pad contact |

The typebars pivot on a circle whose centre is the printing point, each about the tangent to that circle, so every bar swings in a plane through the printing point and arrives square to the platen. Bars at the ends of the segment see their draw link arrive from a different direction than the middle ones; each heel is clocked to stand square to its own link at mid-stroke, as on real machines, or the outer bars would reach a dead centre before the platen. The sub-lever's input arm is solved per key so that full key dip (14 mm) brings the type face exactly to the paper.

Discrete latches, set from simulated positions each substep: which dog overlaps the wheel (from the rocker angle), which tooth each dog will meet, the pinion ratchet's index, the line pawl's pick-up tooth, the backspace pawl's engagement, the bell trip's one-way arm.

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
| Finger | 20 g, pad 3×10⁴ N/m, default push 3.2 N | |

## 5. What a keystroke looks like

Default touch, key H, times from the finger starting to push: universal bar picked up at 47 ms; dogs swap at 52 ms; impact at 55 ms with the face arriving at 4.1 m/s and peaking near 85 N; carriage on the next tooth at 91 ms; typebar back on its rest at about 110 ms. The finger does about 48 mJ of work; the typebar arrives with about 22 mJ; the letter space releases 23 mJ from the mainspring, none of it from the finger.

Because the last tenth of key travel moves the typebar 15°, holding the type against the paper takes nearly 3 N at the key. A key struck and held therefore lets the bar rebound, come back and print a fainter second image after the carriage has started to move: the shadow that typing manuals warn against, and the reason for a staccato touch. The model produces it without being told to (`tests/typing.test.ts`).

## 6. Checks

`npm test`.

- Solver against closed forms: large-angle pendulum period (2×10⁻⁴), four-bar closure (10 nm) and energy, rebound height `e²h`, spring-damper contact duration, restitution and indentation, static torque balance.
- Keystroke: causal order of events; one mark, one space; link error under 10 µm; simulated pose equals independent loop closure; a slow press reaches the paper but does not ink; harder touch means faster, harder, darker; finger work exceeds typebar energy while the spring pays for the space.
- Counterfactuals: no draw link, no print and no space; typebar missing the universal bar, no ribbon lift and no space; ribbon linkage unhooked, a blow with no ink; mainspring let down, a trip with no space.
- Convergence: impact time within 1.2% and approach speed within 3% between 25 µs and 6.25 µs.
- Replay: restoring a snapshot reproduces the future bit for bit, including from the middle of an impact.
- Typing: bursts print in order with nothing lost at 8–20 strokes per second; repeats, shift, space, backspace, carriage return, bell, line lock and auto return; light, normal and heavy touch give distinct darkness; a typist reset after a restore starts clean.

## 7. Limits

- Carried-part inertia is neglected (section 1). It matters only if a carried part were heavy and off-axis.
- No friction at contacts other than the lumped Coulomb terms on coordinates. The force needed to slide a loaded dog off its tooth is not felt at the key.
- Typebars cannot clash; the typist layer keeps one type in flight.
- Paper and ribbon are geometry, not bodies.
- First-order integration: in the free-swinging tests the energy error after one second is about 0.01% of the swing energy.
