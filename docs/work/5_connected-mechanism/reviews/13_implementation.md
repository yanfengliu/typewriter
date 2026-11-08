# Independent energy and contact derivative review

## Target

Uncommitted frozen snapshot manifest00D841B2D9BF828301887E220B06DD55630629953EA222BB5A04352FBA447386, based on b0e5175. Scope reduced-energy.ts, typing-energy.ts, link-derivatives.ts, auxiliary-contacts.ts and three focused test files; dependencies are explicitly frozen.

## Reviewers and coverage

Independent material_review, gpt-6-astra, xhigh, verified all20 hashes and used independent Cartesian body-motion, virtual-work, finite-difference and endpoint probes. This is an agent review, not a dual-CLI review.

## Reports

Primary checkout output/typing-energy-review/review.md, SHA256 EF532DE33A1BA80D20A9B24527F309F7D607C57A587377003BD8136F3C0BB7AA, with frozen source, manifest and runnable probes.

## Findings and disposition

P2-TEN-001: a prepared key energy curve ends at strokeLimit, but the assembler takes symmetric derivative samples beyond it. Thus even an in-range mass/potential query at or just below the endpoint throws. Do not clamp queries or require unsupported geometry beyond closure; repair endpoint derivative evaluation and re-review. No other actionable findings within the bounded scope.

## Verification

All12 focused tests pass. Independent suite has6 passes and the endpoint failure. Cartesian checks cover all energy terms including44 idle rods, explicit support once, off-diagonal mass and Christoffel terms, idle-rest reaction signs, all45 key derivatives/both shifts, mixed contact Hessians and held-out prepared energy values. No full gate/browser was rerun; disposable worktree removed.

## Round outcome

Reject prepared mode pending the endpoint repair. Passing checks support the declared body's energy and smooth contact equations, not calibrated masses, actual full-cycle motion, valid idle-rest elimination throughout a cycle, finite edge/stencil contact, pressure-driven ink, performance or assembled clearance.
