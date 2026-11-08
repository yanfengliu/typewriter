# Review 30: repaired energy-module delivery

## Target

Five-file repair handoff at connected-mechanism/output/handoff/energy-provider-repair, manifest SHA-256 ce0b4e2584007116a421246c56f4713b5fe0b0b0ff7a65680a0132b7f9eca9a9, base bdc31f9324e5321873659da7f28d5941cad354eb. Exact file hashes and retained recovery locations follow in the authored report.

## Reviewers and coverage

Independent energy_delivery_review, gpt-6-astra at xhigh. Bounded native-agent re-review of EDR-1, dense arithmetic, aliasing and cache recovery; not external dual-CLI review.

## Reports

### energy_delivery_review

Authored follow-up report, without substantive edits. Original report SHA-256 3a2e533057ff61d9ab0ecfc9cf3b7b62222effdc265d53386c916e61f6a1a9bd.

> # Independent energy-module delivery review, repaired bytes
>
> Reviewed on 2026-11-08 by the same independent Codex review worker. This is a bounded follow-up to `report-before.md`, retained unchanged. Base main remains `bdc31f9324e5321873659da7f28d5941cad354eb`. No delivery source or test was edited by this worker.
>
> ## Exact reviewed input
>
> All five repaired delivery inputs are preserved under `inputs-after-repair/`. `sha256-repair-before.txt` and `sha256-repair-after.txt` match. The source hashes were checked against the owner's supplied handoff. During this follow-up the delivery status gained only the owner's `docs/work/5_connected-mechanism/reviews/29_implementation.md`; its tracked diff was unchanged at the comparison point. Subsequent owner documentation work is outside this byte-frozen review.
>
> | File | SHA-256 |
> | --- | --- |
> | `src/mechanism/reduced-energy.ts` | `493763d44f9b25cb0187182cdcb5c93795b13d13e609857c23a2b0ab6cce6742` |
> | `src/mechanism/carried-rotor.ts` | `d6e789602cbe7c02a1a328a74d94f452501940a57779b2ff0817018e60103139` |
> | `tests/reduced-energy.test.ts` | `3dd931f43ccf971f515aece3104317069c8bf7201de86300b4a8c52a47b46348` |
> | `tests/reduced-energy-cache.test.ts` | `156803465f72aa196d9a048e0cf05c1b839c0f38e93606a7ccec3c3912a3f370` |
> | `tests/carried-rotor.test.ts` | `dbf9edfbd974e93081b6882d09d983850875d4d3742421f4fb3bf4bf264ddce4` |
>
> ## EDR-1 disposition: fixed
>
> The repair replaces sparse-skipping mass and derivative copying with indexed finite-value validation and dense copying. Missing mass rows/scalars and derivative matrices/rows/scalars reject before cache insertion; gradient scalar holes continue to reject through the dense gradient copy. The symmetry arithmetic, finite-difference arithmetic, scatter order and Christoffel contraction are unchanged. The carried-rotor helper is byte-identical. No additional material finding arose from the repair diff.
>
> The unchanged original sparse-provider probe now reports the intended validation error for all 120 accesses: six fault locations, five public methods, capacities 0/32 and cold/warm inputs. None installs an invalid cache entry. Its constructor/nonfinite controls also pass. Evidence: `probe-sparse-after.json`.
>
> To avoid overstating the original probe's recovery diagnostics, an assertion-only derivative of that script adds an unconditional check of successful same-coordinate recovery. All 120 cases pass: after restoring the provider's valid outputs without clearing the cache, both mass and the full derivative tensor equal their expected values at the identical q. Evidence: `probe-sparse-repair-assert.ts` and `probe-sparse-repair-assert.json`. The owner's new checked-in regression additionally covers capacity 1, every public rejection and revisiting the prior valid mass/gradient state; the owner runs that test in its delivery gate.
>
> The dense algebra and aliasing probe was rerun because the repair changes the copying path exercised by all energy methods. Its 160-state output and every maximum error are byte-identical to the original probe output. Evidence: `probe-algebra-after.json`. The sparse probe, dense probe and recovery assertion each completed in about 0.53-0.56 seconds. No tolerance was changed.
>
> ## Disposition and limits
>
> Accept the repaired five-file delivery for the reviewed module scope. There are no remaining material findings from this review. Root owns full suite/build gates and final Git delivery. This review does not certify public-app integration, an operating cycle or real-time performance; these helpers are not wired into the public application. No external CLI reviewer lane, browser, GUI or server was launched. The detached reviewer worktree is removed after preserving these inputs and reports; all authored evidence here is intentionally retained. Scoped process inventory found no surviving task-owned Node/browser process.

## Findings and disposition

EDR-1 is closed on these exact repaired bytes. Accept the energy composition and carried-body helper for a reusable numerical milestone, leaving the public mechanism unactivated. Original rejection remains in review 29.

## Verification

Root delivery gate passes all 104 tests and the Pages build. The unchanged public JS bundle has SHA-256 B30F261E301FBAED3607DFDA9E2E524BF02E927E9FC662C47B413005CB4586BC. Full uncommitted physical integration is a different target and still has five inherited facade failures.

## Round outcome

Accepted within module scope. This proves the tested energy algebra and finite cache/provider contracts; it does not prove assembly clearance, complete typing cycles, real-time operation, tutorial integration or phone performance.
