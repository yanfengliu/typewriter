# Independent unilateral dynamics kernel review

## Target

Exact commit 3b280cb0b4818802ece1bf23812e92842ea3294e, new src/mechanism/unilateral.ts and its tests. Source Git-blob SHA256 A4720911F40C4EA94C0B56750C11E909BB899B04496817BB6AF47A1765325910. This is a bounded numerical module review, not approval of the connected Royal mechanism.

## Reviewers and coverage

Independent mechanism_audit, gpt-6-astra, xhigh, in a disposable detached worktree. Reviewed signed contact impulses, full variable mass/Christoffel terms, moving-wall work, sustained support, release and collision ordering, redundant/scaled normals and event completeness. Root inspected the report and retained fixtures.

## Reports

Retained output/unilateral-review/report.md, SHA256 056E730E1A950758A1CB7BC43AFEC1ED553C286B99BE893A70324C22B3895BBC, with original source/test blobs, reproducible independent probes, logs and hash manifest. Checkout newline conversion was independently reconciled to the frozen Git bytes.

## Findings and disposition

UR-1, P2, open: simultaneous force releases record only the first contact ID. Two equal masses at separate floors with identical smooth force t-0.05 both release physically, but only contact a appears in releases[]. Accurate tutorial/event consumers need every physical release. unilateral_solver owns repair, deterministic coalescing tolerance and separated-in-time regression; independent verification of the repaired exact revision is required. No other material issue was found in this bounded review.

## Verification

Committed analytic tests pass 15/15; independent probes pass 5/6, with UR-1 the sole failure. Both prior event-detection fixes pass independent held/free/recollision and same-bracket earliest-impact checks. No full application suite, browser or Royal integration was tested by this review. The bounded eight-sample swept detector is not a universal continuous-contact certificate. Review worktree removed, no browsers, servers or GUI processes launched.

## Round outcome

Proves the specified analytic dynamics, contact signs and event-order repairs under the tested smooth gaps and scales. Does not yet prove complete release reporting, source-correct geometry, feasible routing, supported ink, whole-machine behavior or deployment. Root accepts UR-1 and keeps activation unapproved pending repair and integration evidence.
