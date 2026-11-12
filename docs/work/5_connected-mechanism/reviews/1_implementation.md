# Numerical foundation implementation review

## Target

Exact revision 1bbfcd219ddfeb082c5b2ddc05982236e2fbedf0. Scope: new math/dynamics primitives and their tests; disconnected from the public application.

## Reviewers and coverage

Independent Codex subagent energy_review, gpt-6-astra, xhigh. Date: 2026-11-08 UTC. Read-only exact-revision numerical review in an isolated worktree, with bounded analytic probes and tests.

## Reports

### energy_review

Reviewed **1bbfcd219ddfeb082c5b2ddc05982236e2fbedf0** independently. Three material numerical findings and one minor degeneracy finding remain on that revision. No application edits.

1. **ENERGY-01 — P1: Supported upper contact causes unbounded recursion.** Location: src/mechanism/dynamics.ts:104–112, especially line 112. Reproduction: M=.001, V(q)=(q-.08)^2, y(q)=.08q, bounds [0,.15], damping 0, initial q=.04; call step(1/240, 0, .04, 0). This throws RangeError: Maximum call stack size exceeded. After the zero-time upper impact, the passive force still pushes toward the stop; recursively processing the remaining interval repeats that contact without consuming meaningful time. A unilateral support needs to balance an inward load while resting, then permit separation when the load changes. This is a valid smooth potential and an ordinary blocked mechanism, not invalid input.

2. **ENERGY-02 — P2: Endpoint-only detection misses contact during a turning trajectory.** Location: src/mechanism/dynamics.ts:92–101. Reproduction: M=.001, V(q)=.064q, y(q)=.08q, bounds [0,.15], damping 0, initial q=.03995, setVelocity(.12), stop .04, force 0. One step(1/240) reports stopped=false, zero impact loss, and finishes at .0398944444444. The exact free trajectory first crosses the stop at .0004774575141 s and reaches .0400625 before returning. Two steps of 1/480 detect the contact and dissipate approximately 4e-6 J, ending at .0395644715465. Thus event ordering changes at the intended 240 Hz timebase even though the energy ledger residual is approximately zero. Event localization must inspect the interior turning point or establish a monotone interval before checking for crossings.

3. **ENERGY-03 — P2: The conserved ledger uses the interpolated metric's inertia, not the supplied physical inertia.** Locations: src/mechanism/dynamics.ts:36–49, 75–80; test gap at tests/action-energy.test.ts:40–59. distance() interpolates linearly, while velocity and setVelocity use that table's derivative. Consequently, kinetic=.5*speed² generally differs from .5*M(q)*velocity². Independent analytic reproduction: M(q)=(1+q)^2, V=0, y=q, bounds [0,1], default 256 samples, initial q=.001, setVelocity(1), duration .1 s.

| Quantity | Result |
|---|---:|
| Exact final coordinate | .09644926923228 |
| Computed coordinate, dt .01, .001, .0001 | .09653609625668 |
| Coordinate error at every timestep | 86.827 µm |
| Initial physical kinetic energy | .5010005 J |
| Final physical kinetic energy | .50271851113 J |
| Physical energy gain | .00171801113 J, about 0.343% |
| Reported ledger residual | 0 |

The error does not shrink with timestep refinement. The supplied variable-inertia test checks the integrator's own ledger, so it cannot detect this mismatch. Check physical kinetic energy directly and add independent variable-mass trajectory and metric-resolution convergence checks. These numbers describe the analytical test system; they are not measurements of the Royal linkage.

4. **ENERGY-04 — P3: A valid degenerate closure is classified as unreachable.** Location: src/mechanism/math.ts:31. closeLink([0,0,1], {pivot:[0,0,0], axis:[0,0,1]}, [1,0,0], Math.sqrt(2), .7) returns {angle:.7, error:0, reachable:false}. Here every follower angle satisfies the rod length. Zero amplitude means the constraint cannot determine the angle; it does not necessarily mean the linkage is unreachable. Preserve the prior angle with a valid closure result or distinguish singularity explicitly. No evidence establishes that the current fitted mechanism encounters this configuration.

Verification: all six new tests passed under Node v24.12.0. They provide meaningful evidence for the selected closure/rigidity cases, constant-mass oscillator convergence, and ledger accounting on their particular trajectories. They do not establish robust stop handling or physical energy convergence for general variable inertia. No legacy-suite success was used as Royal-physics evidence.

Outside-diff grounding: src/mechanics.ts:94–97 still launches the legacy impulse; src/main.ts:3 imports BufferedTypewriter. An exact-revision search across src found no consumer of ConstrainedAction or KineticMetric. The plan correctly leaves M2 In progress at line 106 and states the modules are disconnected at line 144. Line 140's "proves those numerical primitives" should be limited to the specific tested cases until these findings are resolved. This review does not cover Royal geometry, rendering, printing, input preservation, deployment, or browser performance.

The isolated review worktree and its two temporary probes were removed. No browser, server, or persistent process was launched. The implementation owner has accepted ENERGY-01 and ENERGY-02 and proposed repairs addressing ENERGY-03; those repairs require review at their committed revision.

## Findings and disposition

Accepted ENERGY-01, ENERGY-02, ENERGY-03 and ENERGY-04. Repairs committed at 5fc8494. Independent re-review is pending.

## Verification

Accepted all four findings. Added static support reactions, interior turning-point inspection before event bracketing, intra-cell Simpson integration with physical sqrt(M) velocity conversion, and explicit singularity diagnostics. Added all four reproductions, including the independent variable-mass exact solution at three timesteps. Eleven focused tests and all 47 repository tests pass. This establishes repaired behavior for those cases; an independent re-review of the repair commit is still required. No claim is made about the Royal action or rendered contact yet.

## Round outcome

Original revision has three material findings and one minor finding, with repairs and new regression tests at 5fc8494 awaiting re-review. M2 remains in progress. The first record failed the work-document heading schema; this documentation correction supplies the required sections without changing the authored report.
