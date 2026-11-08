# Rebuild the typewriter as a connected mechanical simulation

Status: active
Owner: Codex
Created: 2026-11-08
Updated: 2026-11-08

## Problem and outcome

The owner requires the 3D typewriter to operate through the actual mechanism and asked for a comprehensive plan with tracked progress. The present program has a reduced dynamical model, but the renderer stretches keylevers, interpolates typebar orientation, poses escapement dogs from carriage travel, and prints from an angle threshold. The tutorial also runs separate prescribed poses. The rebuild must make connected geometry, forces and contacts determine both operation and visible motion. This unit tracks the entire rebuild; preparing this plan does not complete implementation.

## Scope

Include all mechanisms needed for ordinary typing: key action and return springs; typebar basket, guide and two-face slugs; universal-bar trip; ribbon lift, feed and reversal; platen and paper support; mainspring/drawband; rack, pinion, escapement wheel and dogs; basket shift; carriage return and line feed; Space, Backspace, Tab, margins, line lock and bell. Retain the buffered input contract, permanent impressions, saved sheets, mobile controls, and GitHub Pages publication. The external visual style may remain, but pivots, part spacing and internal geometry may change to fit a coherent working mechanism.

Use one documented manual front-strike, basket-shift mechanism family. The Royal mechanism in the 1955 service manual is the initial candidate. M1 must identify its exact applicable model/variant and confirm its escapement sequence from the complete manual before dimensions or timing are frozen. The current full-drop assumption is not a historical fact about that candidate. Do not combine a half-drop diagram, full-drop timing and an unrelated shift assembly and call the result a faithful reconstruction.

Model rigid links, joints, springs, contact, friction, rubber compliance, constrained paper feed and macroscopic ink transfer. Microscopic fabric/fiber/fluid simulation, manufacturing damage, and arbitrary crumpling or tearing are outside the first release. Paper must still have consistent length, thickness, platen contact and feed. Cosmetic hardware may be simplified only when it has no causal role. Mark dimensions and material parameters as documented, reconstructed from drawings, or estimated; no claim of an exact historical digital twin without measurements.

## Approach

### Evidence and baseline

Baseline inspected: 4a71edf27556f06b24a0706d1493cf9d72dc7a4a. The main gaps are in src/scene.ts: key construction around 168–196, fixed decorative escapement geometry around 209–240, typebar geometry around 408–432, and applyMechanicalPose around 784–819. src/mechanics.ts applies key work directly to typebar velocity, uses normalized angle for impact, and stops carriage travel at a programmed target. src/tutorial-model.ts prescribes separate teaching poses. src/buffered-typewriter.ts immediately calls press/release and will need an explicit finite actuation/acceptance contract for the new mechanism.

Primary research: [U.S. Navy Basic Machines, chapter 12 and figures 12-5 to 12-8](https://files.eric.ed.gov/fulltext/ED173578.pdf#page=106) supplies a complete example of key linkage, universal bar, escapement and ribbon action. [Royal service manual, 1955](https://site.xavier.edu/polt/typewriters/Royal1955.pdf) supplies a candidate coherent basket-shift family and detailed assemblies. [USPTO Class 400, subclass 329 definitions](https://www.uspto.gov/web/patents/classification/uspc400/defs400.htm) distinguishes full-drop, half-drop and reverse escapement sequences. Initial research verified these are different sequences; the Royal full PDF fetch timed out, so indexed excerpts are not sufficient to mark model selection complete.

### One authoritative mechanism definition

Introduce a pure TypeScript mechanism definition in SI units: rigid bodies and mass/inertia; local attachment points; hinge and slider axes; link lengths; gear ratios; springs and preload; travel stops; collision/contact shapes; glyph faces and material settings. Every active visible part has a stable component ID. The simulation, renderer, diagnostics and tutorial refer to those same IDs and local frames. Collision primitives and visible surfaces derive from the same dimensions, including face thickness, ribbon thickness and platen radius.

Use reduced coordinates and analytic linkage closure for constrained assemblies where possible, with forces projected through the linkage geometry. Use contact constraints/impulses for stops, dogs, ratchets and impacts. Include real lost motion or slots when the selected mechanism requires them. Start with the existing fixed 240 Hz timebase, add swept contact/event localization or adaptive substeps for fast impacts, and verify convergence against finer steps. This is a small mechanical solver, not a timeline driving independent part poses. A general physics engine is a fallback only if the single-key prototype demonstrates an actual need; a new major dependency requires its normal review before adoption.

Energy enters through a virtual finger applying a finite force/travel pulse to a key, a hand moving the return/shift controls, and stored spring energy. A keyboard cannot measure real finger pressure, so the pulse uses a documented force setting. Mass, spring stiffness, damping, friction and contact losses must account for motion and dissipation. Derive effective inertia and mechanical advantage from the mechanism rather than launching every typebar with an identical impulse. Winding the carriage spring during return must account for its replenished energy.

The renderer consumes solved body transforms and contact events. Remove arbitrary lever scaling, independent typebar interpolation and dog motion calculated from carriage position. Rigid geometry is constructed once. Render interpolation must evaluate a constraint-consistent pose or use solved snapshots without stretching joints between frames. Presentation never changes physical state.

### Key actuation, shift and no lost input

Keep the input buffer as an explicit virtual-operator layer. Accepted hardware/touch input is retained immediately; the operator actuates keys only when the mechanism can accept the next stroke. A queued uppercase or shifted symbol first moves the shift linkage to its detent, then presses the correct physical key while holding the basket position. Store intended character/settings at input time as today, but obtain the printed character from whichever physical face actually contacts the sheet.

Replace instantaneous press/release dispatch with a finite pulse and acknowledgement: a queued stroke leaves the queue only when the actuator accepts responsibility for it. It produces at most one committed impression per distinct valid contact episode. Preserve pending controls, hard-margin recovery, repeat-letter behavior, slow-motion operation, unloading warnings and no automatic wrapping. Derive busy/ready from active mechanism constraints, including shift settling and carriage detents, rather than fixed delays. Real faults remain possible in direct component tests; normal buffered typing avoids overlapping key actions. This separation preserves the owner's no-missed-typing request without pretending a physical typewriter has a digital queue.

### Contact and paper

Compute the two typeface transforms from the slug and basket geometry. Detect approach and compression of the inked ribbon against the supported paper/platen using swept geometric contact. The glyph that touches supplies its shape; the contact point projected into sheet coordinates supplies placement; contact impulse/pressure and ribbon condition supply impression strength. The glyph stencil and display face must share dimensions and orientation. A visible contact cannot disagree with the printed location.

Keep impressions append-only. Reversing the carriage/feed changes where the next mark lands; it never deletes an earlier mark. Avoid duplicate marks from solver substeps or rebound chatter. Ribbon absence or stencil selection produces no ink; an absent sheet receives no mark; insufficient energy cannot create a normal impression. Model ribbon path length, spool radii, winding, feed ratchet and reversal consistently. Lift must come from the actual actuation linkage, not from a typebar-angle shortcut.

Retain an inextensible sheet representation with a defined neutral surface and thickness around the compliant platen and feed rollers. Couple arc-length travel to platen rotation under the chosen grip/slip model; support the outgoing sheet with a documented bending approximation. Backspace and reverse feed must preserve the paper's material coordinates. Use the existing stored sheet/impression format where it can represent the result; do not silently introduce a storage migration. If exact geometric placement requires a format change, define compatibility, recovery and migration separately before changing it.

### Escapement and other controls

Model the mainspring/drawband pulling the carriage through a rack/pinion/wheel relationship. The universal-bar linkage changes the rocker/dog constraints; contact with the selected tooth arrests travel. Carriage motion drives the wheel through the gear constraint, while the engaged dog can resist both. Remove the direct one-column target clamp as the mechanism's normal stop. Verify the selected design's contact/release sequence and stationary impression interval rather than assuming every typewriter releases at the same instant.

Space actuates the escapement without a typebar. Backspace uses a pawl to index the carriage against the mainspring. Tab releases the relevant hold and stops at a tab stop; margins and line lock limit travel. Shift moves the supported basket with its links, guides, stops and springs. The return lever drives the line-space pawl/ratchet and moves the carriage against the mainspring; platen detents determine line position. Connect the bell trip to carriage position mechanically. Their appearance, force paths and movement all use the same component definitions.

### One simulation for typing and teaching

Replace prescribed tutorial poses with deterministic demonstrations run by a second instance of the same mechanism and operator. Record valid snapshots and events, or deterministically replay from checkpoints, for scrubbing. The live document and queue remain paused and isolated. Chapter moments attach to actual events such as key descent, ribbon arrival, contact, dog handoff and arrest; slow motion changes presentation time while preserving integration steps.

Provide cutaway views, fixed-pivot markers, force/motion arrows attached to solved components, and close-up cameras on the actual 3D linkage. The SVG explanation may remain as a projection of these same solved states. Exploded assembly view freezes operation and applies presentation offsets only; reassemble before resuming the mechanism. Narration must state what the visible parts are doing and match the selected machine variant. Test that someone can trace the finger-to-ink and spring-to-spacing chains without relying on a separate invented animation.

### Intended code boundaries

| Area | Responsibility |
|---|---|
| src/mechanism/definition.ts and reference data | Bodies, attachment frames, constraints, dimensions, sources and uncertainty tags |
| src/mechanism/kinematics.ts | Linkage closure, gear/rack coupling, typeface and attachment transforms |
| src/mechanism/dynamics.ts and contacts.ts | Forces, integration, stops, collision events and contact episodes |
| src/mechanism/operator.ts | Buffered virtual key/shift/return actuation and acceptance |
| src/mechanics.ts | Public machine facade and compatibility while replacing old shortcuts |
| src/contracts.ts | Mechanism snapshots/events and existing application contracts |
| src/scene.ts | Geometry built from definitions; apply solved poses; cameras and picking |
| src/paper.ts | Permanent impression rendering and existing persistence boundaries |
| src/tutorial-model.ts, tutorial.ts and mechanism-diagram.ts | Event-based lessons, replay, projection and teaching controls |
| tests/ | Constraint, contact, counterfactual, buffer, storage, replay and integration regressions |

Exact file division may change during the single-key prototype; these responsibilities and dependencies should not.

## Acceptance criteria

- [ ] Select and cite one coherent reference variant, publish its component/force-path map, and label all reconstructed/estimated parameters.
- [ ] Every active rendered component follows the solver's shared geometry and joint constraints; rigid links never scale to reach endpoints.
- [ ] A single key's connected action produces a geometrically valid face/ribbon/paper/platen contact; ink is generated only from that contact.
- [ ] Mainspring, rack, wheel and dogs determine carriage travel and arrest; normal spacing is not a programmed target position.
- [ ] Shift, return, feed, ribbon and other controls operate through their modeled connections; all printable keys and both faces are aligned.
- [ ] Counterfactual tests demonstrate causality: disconnect a key link before actuation and the bar is not driven; block before contact and no letter prints; remove ribbon and no ink transfers; lock the escapement and no carriage step occurs; remove spring pull and no spring-driven advance occurs; perturb contact geometry and the detected strike changes with it.
- [ ] Preserve permanent ink and all existing user-facing buffer/storage guarantees, including zero-delay bursts, shifted punctuation, repeats, margin recovery, pause/resume, save/reload and tutorial isolation.
- [ ] Tutorial and normal operation use the same solver; recorded teaching poses satisfy the same geometry/contact invariants.
- [ ] Numerical convergence, energy accounting, readable desktop/mobile rendering and the performance budget pass on recorded hardware/browser configurations.
- [ ] Independent review of the exact integrated revision has no unresolved material findings; production build, Pages CI and live verification pass; task-owned resources are cleaned.

Initial numerical verification targets, to be fixed in M1/M2 before acceptance: link-length error at most 1 micrometer, joint closure error at most 10 micrometers, unintended rigid-contact penetration at most 0.05 mm, and printed alignment error at most 0.1 mm against the selected print datum. These are solver/registration targets, not measured historical manufacturing tolerances. Compare timestep refinement and different display rates (30/60/120 Hz plus jitter/stalls) for identical event ordering and impressions, with final placement within 0.05 mm. Account for input work, spring potential, kinetic energy and dissipation; the passive system must not create energy beyond a bounded, reported numerical residual that shrinks with timestep refinement. Any target change needs an explained engineering reason and recorded review, never a silent relaxation to pass a test.

Target 60 fps on the available desktop and at least 30 fps on a named representative phone while preserving physical/event accuracy. Record frame-time percentiles and solver cost during a long burst, tutorial playback and cutaway view. Mobile viewport emulation verifies layout, not native phone performance; report real-device performance as unverified if that hardware is unavailable. Optimize sleeping inactive mechanisms, shared geometry, instancing and cosmetic quality before reducing solver fidelity.

## Implementation steps

### Progress board

| Milestone | Status | Work and dependency | Exit evidence |
|---|---|---|---|
| M0 — Audit and plan | Verified | Audited current shortcuts and defined architecture/gates; independently reviewed plan and stored tracking | Plan d9a2b961; [independent plan review](reviews/0_plan.md); no functional changes |
| M1 — Reference and specification | Verified | Royal standard segment-shift pica family; documented topology, clearances, clutches and sequence; unknown dimensions explicitly fitted | [Source specification](design.md), integrated at 8ba83ef; scanned manual visually inspected |
| M2 — One connected key | In progress | Numerical foundation independently reviewed; connected geometry, contact and rendering under development in codex/connected-mechanism | Twelve numerical tests pass; reviews 1–3 close ENERGY-01–05; complete mechanism acceptance remains pending |
| M3 — Physical printing | Planned | After M2, add two-face slug, supported paper/platen and connected ribbon lift/feed | Geometric contact and registration tests; absent-ribbon/paper and blocked-bar tests; permanent overstrike proof |
| M4 — Carriage and escapement | Planned | After M2/M3, connect universal-bar trip, mainspring, drawband, rack, pinion, wheel and dogs | Reference-correct event trace, one-tooth arrest, locked-dog/removed-spring tests, spacing and energy accounting |
| M5 — Whole machine and operator | Planned | After M4, extend to every key and shifted face; add finite buffered actuation and all controls | Full keyboard alignment/collision sweep, shifted punctuation and long-burst parity, control/margin/jam recovery and storage regressions |
| M6 — Shared tutorial | Planned | After stable M5 events, run lessons through a second solver instance and replay validated snapshots | Live/tutorial pose equivalence, causal narration, non-mutating scrubbing, cutaway/explosion behavior and teaching checks |
| M7 — Verification and delivery | Planned | Integrate, profile, independently review exact code; fix and re-review; deploy | Passing gates, quantitative error/performance report, desktop/mobile captures, Pages run and live verification |

Root owns the shared architecture, interfaces, acceptance and integration. Delegate only bounded independent work after the mechanism definition is agreed, for example reference extraction, scene construction from frozen geometry, or independent review. Keep tightly coupled solver/geometry work with one owner until M2 passes. Retain all implementation and review history in this work unit; substantial milestones may merge separately, but incomplete mechanisms must stay out of the public default mode until their acceptance gates pass.

### Progress update rules

Use Planned, In progress, Verified or Blocked for milestone rows. Verified requires inspected evidence, an exact revision and passing relevant checks; writing code or passing a build is insufficient. Update this board at milestone boundaries and whenever a material blocker or scope decision changes it. During active work, user updates say what was verified, what is being worked on next, and the specific remaining uncertainty. Do not invent a percentage complete or a delivery time before the M2/M4 solver risk is measured.

For every deliverable, explicitly record what it proves and what it does not prove yet, in both the user update and the evidence log. Keep geometric, dynamical, rendered, input/persistence, and real-device performance evidence distinct.

Maintain a concise evidence log below and link each review round from this plan. Raw logs/screenshots remain ignored; retain selected evidence deliberately. A blocked item names the failed check, alternatives already tried, its owner and next action. Preserve original findings and fixes rather than rewriting earlier reviews. Do not mark the full work unit complete until M7 passes.

### Risks and planned responses

| Risk | Response |
|---|---|
| Reference drawings lack dimensions or mix variants | Resolve the variant at M1; use known dimensions as scale anchors, record fitted values and uncertainty, and avoid exact-replica claims. |
| Overconstrained linkage, singularity, chatter or tunneling | Prove one mechanism first, account for slots/lost motion, use event-localized contact and timestep refinement, and do not hide drift with mesh scaling. |
| Dozens of actions make the solver too expensive | Sleep inactive bodies, exploit constrained coordinates and symmetry, simplify cosmetic geometry, then profile before adopting a new engine. |
| Input queue empties before shift or a key is accepted | Use finite operator pulses and acceptance acknowledgements, preserve snapshots, and test interruptions plus rapid mixed controls. |
| Physics improvements change existing timing assumptions | Rewrite only assumptions contradicted by the selected reference with explicit review; retain user-facing no-loss, no-erasure and persistence contracts. |
| Tutorial drifts from the real simulation again | Require the same definition/solver and event IDs; replay recorded physically valid states instead of independently authored poses. |
| Visual plausibility is mistaken for correctness | Combine invariant, counterfactual, numerical and rendered checks; label fitted parameters and remaining approximations. |

### Evidence log

- 2026-11-07: Audited baseline 4a71edf27556f06b24a0706d1493cf9d72dc7a4a and rechecked primary source descriptions. Identified the source-variant timing issue and the queue's instantaneous press/release compatibility risk. Created this plan and progress board. No application code or behavior changed; implementation milestones remain planned.
- 2026-11-08: Independent read-only review of plan d9a2b961efacdab92d48c4f8b429290f0a43a9c6 reported no material findings. Work-document structure, whitespace and relevant diff secret checks passed. M0 is Verified; M1–M7 remain Planned. Dates in the allocation/review record use UTC.
- 2026-11-07: M1 source specification integrated at 8ba83ef from worker 2ada8ed2. Proves the documented Royal topology, precontact dog-to-roll transfer, barrel-driven ribbon transport, one-way return clutches and shift-slot sequence. Does not prove reconstructed dimensions, closure, numerical dynamics or rendered/deployed behavior. The new key-action prototype is isolated from the public application.
- 2026-11-07: M2 preliminary deliverable 1bbfcd2 adds a reduced-coordinate, discrete-work integrator and exact fixed-length rod closure. Six focused tests check unreachable geometry, rigid distances, analytic oscillator convergence, work/loss accounting with variable inertia, blocked travel, and an unpowered resting action. Proves the selected test cases, not general correctness of the numerical primitives; does not yet prove the Royal linkage, printing, escapement, scene, input preservation or browser performance. Geometry fitting and complete-key verification remain in progress.
- 2026-11-07: [Independent numerical review](reviews/1_implementation.md) found three material gaps despite the initial passing tests: sustained upper support, a turning path crossing a stop inside one step, and physical-inertia mismatch hidden by an internally consistent energy ledger. Accepted the findings and added independent reproductions and fixes, plus explicit singular-closure diagnostics. All 47 tests pass; repair re-review is pending. This proves the new regression cases pass, not that the integrated mechanical model is verified.
- 2026-11-07: The numerical foundation at b63c5e4 passed [repair review](reviews/2_implementation.md) and [endpoint acceptance](reviews/3_implementation.md); ENERGY-01–05 are closed. Retained this reviewed foundation as a main-branch milestone. Proves the specified analytical/contact cases and their numerical convergence, not the connected Royal mechanism or current public rendering. The full action, carriage, controls and tutorial integration continue on codex/connected-mechanism, with prototype records maintained there until acceptance.

## Outcome

Planning deliverable accepted at d9a2b961efacdab92d48c4f8b429290f0a43a9c6 with [independent review](reviews/0_plan.md). M1 research is complete and M2 implementation is active in codex/connected-mechanism. New numerical modules are not yet connected to the public application. This work unit remains incomplete until the connected mechanism is implemented, independently reviewed and verified live.
