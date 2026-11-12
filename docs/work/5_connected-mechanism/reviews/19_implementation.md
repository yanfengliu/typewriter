# Retained idle-key energy and analytic rod review

## Target

Exact on-disk frozen manifest3AD441A2805EEF047FFE3D76D0E6465F8C3B649750154A5F7142330C71E9CAEF,53 files. The initially quoted AA72751820EFD55EF8B2BF81E00EC0A8C76151DCBAEC07EF36EA826AA9B77E61 hashes the pre-write LF serialization; Windows text output changed only the manifest's line endings to CRLF. Both identities and all per-file hashes were independently verified; no frozen source was changed.

## Reviewers and coverage

Independent material_review, gpt-6-astra, xhigh. Agent review, not dual-CLI. Scope: rod-derivatives.ts, sparse ReducedEnergy.inertialForce, retained-idle/analytic-rod changes in typing-energy.ts and their two new test files. Other snapshot files are dependencies, not newly accepted changes.

## Reports

Primary checkout output/full-bank-energy-review/review.md, SHA2568007A81A940EF12B8A128464E9FB59C5796E0B25D0B82A8CB122261D4A8FC856. Frozen files, corrected manifest identity, focused tests and independent probes remain alongside the report.

## Findings and disposition

No actionable findings. Accept the bounded energy implementation. Analytic moving-frame mass and its two derivatives agree with independent material-point wire quadrature and finite differences. The optional retained model has51 coordinates and141 contributions:45 each main action/support/rod plus six shared terms, with no aggregate idle-rod double count. Sparse Christoffel contraction retains all cross terms. Prepared idle-key endpoints and ordering use each key's own stroke bounds; exact local caches remain correct through independent q/u changes, method order and eviction.

## Verification

Sixteen focused tests and five independent groups pass. Coverage includes held-out volume quadrature for six keys, mixed rigid-frame second derivatives, incremental energy of all44 moving idle keys against the accepted45DDD baseline, raw/prepared sparse-to-dense force equivalence, all45 prepared endpoints with reversed bank order, beyond-domain rejection and cache order/clearing. All53 snapshot hashes were checked again. Review worktree and task processes were cleaned.

## Round outcome

Accept the energy algebra and derivative implementation within its reconstructed-body assumptions. This does not accept51-coordinate contact integration, timed idle flight/recapture, source calibration, full strokes or realtime performance. The legacy seven-coordinate option remains a diagnostic and cannot silently hold released idle keys at rest. Root's separately imported0a1688 kernel is outside this frozen review scope.
