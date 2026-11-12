# Review 32: compact rod dependency

## Target

Root frozen canonical handoff output/handoff/compact-rod-review, manifest E093380AA47AA262FDA87829E0663ACFD94A10D39C3BA5960A3B325B8FCFCC0F, base b0e5175fa08f93a09e3cdd1f5df43b5e3c5f864c. Scope is compact-action.ts, the rod-derivatives dependency import and its new regression; dependencies are context only.

## Reviewers and coverage

Independent energy_delivery_review, gpt-6-astra at xhigh, native agent review. Exact closure/derivative semantics, branch ties, nonfinite states and cache failure recovery. No repeated performance benchmark.

## Reports

### energy_delivery_review

Authored report preserved without substantive edits. Original SHA-256 7b3ecad848f9d065036875ef691a50ecf601a8b9fd35eb5687bb321deb26f62c.

> # Independent compact action-dependency review
>
> Reviewed on 2026-11-08 by the independent Codex review worker. Accepted for the bounded optimization scope, with no material findings. This is native independent-agent review, not an external CLI review claim. Root owns integration gates and any subsequent application experiment.
>
> ## Exact scope and preserved input
>
> Base revision: `b0e5175fa08f93a09e3cdd1f5df43b5e3c5f864c`. Canonical handoff manifest SHA-256: `e093380aa47aa262fda87829e0663acfd94a10d39c3ba5960a3b325b8fcfcc0f`. All 56 manifest files were verified before copying to the reviewer's isolated detached worktree, preserved under `inputs/`, and verified again after the probe. All three live target scope files and target status remained unchanged during this review. The remaining manifest files provide frozen context and are not independently accepted as new delivery changes.
>
> | Scope file | SHA-256 |
> | --- | --- |
> | `src/mechanism/compact-action.ts` | `e83ad4f6d62e8c65ea472ca2117ec4e2b4223534f25f9b82e942b87ba3c188f5` |
> | `src/mechanism/rod-derivatives.ts` | `1f180d2b81201e1914cd86a0e9be807b09e4ade5e9a7eed5b726440f8f9b159c` |
> | `tests/compact-action.test.ts` | `af5f16084b03d63ecc7eab8decab14156a408943ae63a10afa49dffc3e730764` |
>
> The unchanged rod baseline is preserved in the handoff at `output/prototype/rod-derivatives-before-compact.ts`, SHA-256 `550877e515ad40f80aac972f75b0a46e064db1dfe219298caa03f34504cb5099`. The reviewer copied its exact bytes to `src/mechanism/rod-derivatives-baseline.ts` only inside the isolated review worktree so its original relative imports resolve against the same frozen dependencies. No production source was edited.
>
> ## Static assessment
>
> The canonical compact action helper differs from the author's prototype only in relative import paths and its opening comment. The canonical rod module differs from the saved baseline only in dependency imports. No mass, gradient, tensor, frame or memoization arithmetic changed.
>
> `compact-action.ts:8-16` preserves the ordered front, lever and bar `closeLink` evaluations from `kinematics.ts:18-36`, including zero-near branch selection, basket translation and the full reachable/non-singular predicate. It does not introduce the optional disconnected-bar topology: the original `actionDerivatives` dependency also calls `solveAction` with its connected default. The removed work constructs unused body, joint, rod and face output arrays; the original solver does not add a further acceptance predicate from those arrays.
>
> `compact-action.ts:18-24` preserves all three `followerDerivative` evaluations from `link-derivatives.ts:27-36`. In particular, the downstream bar derivative's denominator guard still runs even though the rod evaluator consumes only the lever derivative. The exact singularity threshold remains in `link-derivatives.ts:20`; neither branch tolerances nor derivative formulas were changed.
>
> `rod-derivatives.ts:38-44` still updates its memoized key point and key coordinate only after the complete action dependency and rotating-point evaluation succeed. Universal-coordinate work occurs after this unchanged key memoization, as in the baseline. The review checked failed action queries and failures later in the rod frame calculation separately, including recovery at the previously successful coordinate.
>
> ## Independent bounded checks
>
> `probe.ts` completed successfully in approximately 0.65 seconds. Results are preserved in `probe-result.json`; no timing benchmark or trajectory was repeated.
>
> - 2,349 exact angle/error comparisons across all 45 bank actions, zero and shifted baskets, additional basket offsets, endpoints, fixed and seeded random interior values, broad out-of-range angles, nonfinite q and nonfinite basket drop. Every return value or error name/message matched the full-pose baseline; 784 cases rejected.
> - Diagnostic mathematical chains isolated unreachable and singular closures at each of the three stages. Separate tiny-arm fixtures had a valid three-link pose but failed a derivative denominator guard at exactly the chosen front, lever or bar stage; prior stages were evaluated successfully. All three returned the same `RangeError: Singular link derivative` as the baseline. These fixtures specifically exercise the otherwise unused downstream derivative check.
> - A symmetric branch-tie fixture preserved the baseline's negative equidistant branch.
> - 675 complete rod return/error comparisons used both dependency implementations with the same diagnostic rigid-body definitions. Sequences included repeated and changed q, independent changes to u, invalid q, invalid u and recovery after each error. All full output objects matched exactly, including mass, derivatives, gradient and point/frame jets. Each result also matched a fresh candidate closure, detecting stale memoized results after failure. There were 180 rejected rod queries.
>
> Comparisons use strict deep equality, without numeric tolerances or omitted output fields. The isolated fixtures and frozen existing geometry serve differential evaluator verification; they do not establish a source-faithful machine geometry or operating cycle. The owner's checked-in tests were read, and the owner reports its focused gate passes; this worker did not duplicate those gates or the full suite.
>
> ## Limits and cleanup
>
> The author's reported 604,800 value matches and evaluator speed improvement were not independently rerun and are not used here as application-performance evidence. This acceptance covers exact dependency substitution, domain/branch/error semantics and memoization interaction. It makes no Royal cycle, full-machine success or real-time claim. Source geometry remains outside this review.
>
> No browser, GUI or server was launched. After preserving the exact inputs, baseline, authored probe and report, the reviewer removed its detached worktree. Scoped process inspection found no task-owned review processes remaining. All evidence under this output directory is intentionally retained.

## Findings and disposition

No material findings. Accept exact dependency substitution; the unused downstream bar derivative guard remains mandatory. No geometry, mass arithmetic, root algorithm, contact tolerance or force law was changed.

## Verification

Root eight focused tests and TypeScript pass. After review, one externally bounded canonical two-microsecond diagnostic completed in 4172.2994 ms. Removing only timing, its complete state/events/energy output equals the previous exact-state-cache fixture, including all 45 events. The old-geometry fixture remains a numerical diagnostic. The single 4172 ms observation versus historical 4202 ms does not establish a whole-trace speed improvement; the author's approximately 16 percent evaluator-only median gain is a different workload.

## Round outcome

Accepted for integration, still uncommitted in the unfinished physical branch. This proves exact checked evaluator behavior and the preserved diagnostic trajectory, not real-time typing, an accepted Royal geometry or complete machine behavior.
