# Local printing material and pressure exposure review

## Target

Exact material module and tests at 2ff7e3047a89b05395b1330d29ab347b10dfe6a4. No whole-machine integration or measured Royal material calibration is accepted here. The subsequent repair has its own review11.

## Reviewers and coverage

Independent material_review, gpt-6-astra, xhigh, inspected raw Git blobs and ran focused and independent probes in a disposable worktree. This is an agent review, not a dual-CLI review.

## Reports

Retained output/print-material-review/review.md in the primary checkout, SHA256 F7A7CB29D7212A07F22A041E86B18DCCFF4EE35240E22F29D4B05691872D704D. Frozen original Git source SHA256 e970f33a9c38156833103fb9b1012ae9313c5bbbe6bffae3d004ee20752aa757; tests8456a805a9c47f026182d6297570b4bd722cba44e7f4ff38c5d3fc910eaa6b69.

## Findings and disposition

P2-MAT-001 is open at this revision. Finite unnormalized moments can overflow when normalized after add commits state, and finish can latch an episode before its summary fails. The independent reproduction uses finite positive pressure and finite extreme material coordinates. Reject the candidate until prospective normalization and finalization are atomic.

## Verification

Reviewer reran15 focused tests successfully; independent probes have5 passes and the P2 failure. Passing coverage includes300 analytical pressure paths, discontinuities, bounded storage and non-tensile/passive material work. No browser was needed; review worktree and owned processes were removed. The author196-test full gate/build is not substituted for the independent failure.

## Round outcome

Reject pending P2-MAT-001 repair. The passing checks support the declared passive scalar equation and pressure-weighted bookkeeping for ordinary supplied observations. They do not prove atomic rejection for all accepted finite input, physical parameter calibration, actual contact history, ink density, finite glyph smear, renderer behavior or whole-machine printing.
