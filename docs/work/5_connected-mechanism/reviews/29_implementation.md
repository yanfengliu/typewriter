# Review 29: energy-module delivery

## Target

Main-based delivery tree at base bdc31f9324e5321873659da7f28d5941cad354eb, with the exact five files enumerated in the authored report below. Original reviewed bytes remain in primary output/energy-delivery-review/inputs. This round precedes the EDR-1 repair.

## Reviewers and coverage

Independent energy_delivery_review, gpt-6-astra at xhigh. Native agent review, not external dual-CLI review. Whole-module contract, independent Cartesian/quaternion algebra, finite-output validation and aliasing checks.

## Reports

### energy_delivery_review

The following is the authored report, retained without substantive edits; Markdown quotation supplies attribution. Original report SHA-256 281c4ff5f3dd877c04796addacfb5ef6d31e5a13dccd2416bf4a9188290fb8d5.

> # Independent energy-module delivery review, original bytes
>
> Reviewed on 2026-11-08 by the independent Codex review worker. Scope was the two new energy helpers and their three tests, against base main `bdc31f9324e5321873659da7f28d5941cad354eb`. This is a native independent-agent review, not a claim that either external CLI review lane ran. The delivery tree was read only; code was copied to the review worker's detached worktree. No browser or server was launched. `docs/learning/lessons.md` is absent at the base revision.
>
> ## Exact reviewed input
>
> The five uncommitted inputs are preserved byte-for-byte under `inputs/`, with hashes in `sha256-before.txt`. Before and after hashes, delivery status and tracked diff match. The reviewed code was not changed during this review.
>
> | File | SHA-256 |
> | --- | --- |
> | `src/mechanism/reduced-energy.ts` | `aaf0ca0ea4417150b41125869c1cfaf991845566abe235a8a6d448b1b62b5202` |
> | `src/mechanism/carried-rotor.ts` | `d6e789602cbe7c02a1a328a74d94f452501940a57779b2ff0817018e60103139` |
> | `tests/reduced-energy.test.ts` | `3dd931f43ccf971f515aece3104317069c8bf7201de86300b4a8c52a47b46348` |
> | `tests/reduced-energy-cache.test.ts` | `19c98f82dcf049522a6a4ea1254aec378f6d0a982819d6665057d9c0269a22a3` |
> | `tests/carried-rotor.test.ts` | `dbf9edfbd974e93081b6882d09d983850875d4d3742421f4fb3bf4bf264ddce4` |
>
> ## Finding EDR-1 — P2: Reject sparse provider matrices before publishing or caching an evaluation
>
> Locations: `src/mechanism/reduced-energy.ts:60-63` and `:68-78`. The `some` and `map` methods skip absent slots. In `matrix`, a scalar hole therefore passes the finite check; spreading the row turns the hole into `undefined`, and the symmetry comparison against `NaN` does not reject it. With analytic derivatives supplied, the completed evaluation is accepted and the public mass matrix contains `NaN`. Separately, a missing matrix or row in `massDerivatives` survives the copy and validation, allowing `mass`, `potential` and `potentialGradient` to return successfully. `massDerivatives` and `inertialForce` later throw a `TypeError` while accessing the invalid tensor, after it has already been installed in both caches.
>
> Concrete reproduction: start with the mass block `[[2, .1], [.1, 6]]`, zero analytic mass derivatives and zero gradient, then delete mass scalar `[0][0]`. `mass([1, 2])` returns `[[NaN, .1], [.1, 6]]`. Restoring the provider's valid block and repeating the same coordinate query still returns the cached invalid value. Deleting derivative matrix `[0]` or derivative row `[0][0]` similarly stores an invalid evaluation, even when the first public method subsequently throws during tensor assembly. This violates finite-output validation and failed-evaluation cache atomicity; ordinary dense carried-rotor outputs do not trigger it.
>
> Required repair: validate and copy every expected matrix/tensor/vector index explicitly, rejecting missing entries before cache insertion or any public return. Cover missing mass rows/scalars, derivative matrices/rows/scalars and gradient scalars with every public accessor, cold and warm caches, disabled caching, and a valid retry after failure. Sparse constructor scales and coordinate lists already reject because their spreads make holes explicit; the existing state-coordinate repair also remains intact.
>
> Evidence: `probe-sparse.ts` and `probe-sparse-before.json`. The probe exercised all six fault locations against all five public methods, cache capacities 0 and 32, and cold/warm input states. Missing mass rows currently throw before caching, while missing gradient scalars and derivative scalars already reject with validation errors. Explicit NaN/positive infinity/negative infinity mass values and sparse scales/coordinate-definition controls reject. These distinctions are recorded rather than treating every sparse input as an existing failure.
>
> ## Algebra, integration, cache and aliasing assessment
>
> No further material finding in the reviewed algebra. The parent-hinge translation and relative orientation use the same rotation convention as the existing `src/mechanism/math.ts:11-14`. The derivative tensor order and positive Christoffel contraction match `src/mechanism/unilateral.ts:32-38` and `:270-279`; the kernel subtracts this force and the potential gradient at `:303-304`. The helpers remain unreferenced by the public application at this revision.
>
> `probe-algebra.ts` independently used quaternion rotations and Cartesian velocity/centripetal acceleration to check 160 states with an arbitrary unit axis and every combination of parent/relative signs. It verified kinetic energy including COM rotary inertia, gravitational potential, reordered independent-coordinate inertia, finite-difference mass and gravity derivatives, and direct Christoffel force against `m J^T acceleration`. Maximum absolute discrepancies were approximately `8.48e-21` for kinetic energy, `2.17e-18` for potential, `6.78e-15` for mass derivatives, `7.12e-13` for gravity gradients and `1.02e-20` for inertial force. All fixed tolerances passed; no application tolerance was changed.
>
> The alias probe passed for constructor coordinate/scales copies, cached copies of returned mass/derivatives/gradient buffers, and mutation of every returned public array type. Static inspection and the existing cache tests cover copied/mutated q values, reordered coordinates, per-contribution exact-value keys, LRU eviction, disabled caches, explicit clearing and preservation of the last successful full state on a callback failure. EDR-1 is the invalid-provider exception to that otherwise sound cache behavior.
>
> ## Verification limits and disposition
>
> Both isolated probes completed in about 0.57 seconds after the root released the CPU slot. The worker did not duplicate the full suite or build, start a long benchmark, exercise a typewriter operating cycle or measure real-time performance. Root owns full delivery gates and repair verification. Original-byte disposition: changes required for EDR-1. The repaired bytes require a bounded follow-up review; this original report remains retained as authored evidence.

## Findings and disposition

EDR-1 is accepted as a material validation defect. The original delivery is rejected: no commit or push of these bytes. Root prepared explicit indexed matrix/tensor validation and a whole-class sparse-provider regression; the repair is reviewed separately.

## Verification

Original delivery passes 103 tests and the Pages build, but those gates did not cover EDR-1. The independent failing reproductions, original hashes and source are retained. The passing algebra checks do not override the validation failure.

## Round outcome

Changes required. The algebra is supported on the independently checked states; finite provider-output handling is not accepted until the repair passes re-review. No operating typewriter cycle or real-time performance is proved.
