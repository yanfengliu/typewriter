# Numerical repair review

## Target

Exact repair revision 5fc849468ce78af3e45cf2b9b3900b7227a2df9a.

## Reviewers and coverage

Independent energy_review subagent, gpt-6-astra, xhigh; read-only numerical repair review in isolated worktree. No Royal geometry or application integration coverage.

## Reports

### energy_review

Reviewed exact repair revision 5fc849468ce78af3e45cf2b9b3900b7227a2df9a. ENERGY-01 through ENERGY-04 are resolved. One remaining contact finding requires repair.

**ENERGY-05 — P2: Contact exactly at the timestep endpoint is deferred.** Location: src/mechanism/dynamics.ts:136 and 155–157. Reproduction: M=1, V=0, y=q, bounds [0,1], damping 0, initial q=0, setVelocity(1), then step(1/240, 0, 1/240, 0). The result is q=stop, velocity 1, stopped=false, and zero impact loss. Only the next call resolves the contact and dissipates .5 J. The same failure occurs with dt=stop=.125. Strict >/< comparisons omit an incoming endpoint contact, exposing pre-impact velocity at an already reached support and delaying a downstream contact event by one integration call. Resolve equality for an approaching body and add endpoint regressions, including the lower stop.

Repair verification:

- ENERGY-01: Sustained upper support remained at .04 with zero kinetic energy for 240 steps. Arrival from .03 also settled correctly; reversing the applied load released the support.
- ENERGY-02: The original turning-path case now detects one contact at 1/240, 1/480, and 1/960; final coordinates agree within 2e-15, with impact loss approximately 4e-6 J. The symmetric lower-stop case also passes.
- ENERGY-03: The original analytical variable-mass case now has coordinate errors 2.50e-16, 9.44e-16, and 4.08e-15 at timesteps .01, .001, and .0001; physical energy drift is at most 1.11e-16 J.
- ENERGY-04: The coaxial valid assembly now returns reachable=true, singular=true; the mismatched rod length remains unreachable.

An additional independent probe used M(q)=exp(12q), whose kinetic-coordinate integral and free trajectory have analytical solutions. Final coordinate errors for 32, 64, 128, and 256 metric samples were respectively 2.08e-8, 1.66e-9, 1.04e-10, and 6.49e-12, demonstrating metric refinement convergence. Physical energy drift remained at floating-point scale. This supports the repaired method on the checked smooth domain; it is not a guarantee for arbitrary unresolved inertia variation.

All 11 focused tests passed. I did not rerun the full legacy suite or production build. The plan now correctly limits its proof to tested cases.

Outside-diff verification: src/mechanics.ts:94–97 still uses the legacy impulse, and the exact-revision source search finds no consumer of the new solver. No Royal geometry, live printing, renderer, operator, or performance acceptance is implied.

No application edits, browser, server, or persistent processes. The isolated review worktree and temporary probes were removed.

## Findings and disposition

ENERGY-01 through ENERGY-04 closed independently. Accepted ENERGY-05: detect equality for an incoming endpoint and normalize a zero-restitution velocity to zero. Added upper and lower endpoint regressions.

## Verification

The original analytical and contact regressions remain in the test suite. The new endpoint case must resolve its loss and stopped state in the same call. Coordinator gates and exact repair recheck are recorded with the following milestone.

## Round outcome

One endpoint contact finding remains on the reviewed revision. The numerical foundation remains isolated from the application pending its repair and check. The independently checked numerical results prove the stated test domains, not the connected Royal reconstruction.
