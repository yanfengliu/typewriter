# Idle-key impulse reduction audit

## Target

Frozen root source snapshot archive CC1991897AFF445810844878D5AA19A625E4F9AC26BAAF25E38B4119F629D77D and guarded first-hook event log 576F95D696642FE6FB2004076135131308BA250CD966604ABB1C051AE97CC5B7. The diagnostic uses the exact accepted 0a1688 kernel and the reconstructed source bank; this is separate from numerical repair attempts 6–8.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Agent review, not dual-CLI. Read-only isolated snapshot, exact configured main/support/rod mass and spring parameters, and an independent two-coordinate arrowhead impulse calculation.

## Reports

Primary checkout output/finite-contact-review/idle-key-audit/report.md, SHA256 227C132F7CD43D1007585C3E0C5E49D4F862F8B09D96CCB9CF9787F2DBD26DB0. The archive, per-file manifest and all 44 per-key results are retained alongside it.

## Findings and disposition

Reject fixing all 44 idle key coordinates at their rests through the first hook impulse. Every required generalized rest impulse is negative, from -9.169080644e-8 to -9.509550069e-9 N m s. These are angular generalized impulses, not normal impulses in N s. Finite preload or damping cannot provide an instantaneous retaining impulse.

Releasing the rests gives positive idle velocities 2.851002925e-6–5.290526111e-6 rad/s, a positive hook impulse, zero outgoing hook normal velocity and passive energy loss. The independent momentum residual is 6.62e-24 N m s. The raw and scalar-prepared calculations differ slightly as recorded; neither is silently substituted for the other.

Fixed-bar local flight estimates are extremely small, but are not bounds under subsequent shared-bar forces or impacts. Their size does not waive unilateral support. Retain each idle q/v and its energy, using sparse elimination if helpful; a multiscale approximation would require separate momentum/energy bounds. Do not clip negative impulses, enlarge tolerances, remove wire cross inertia or invent a bilateral hold-down.

## Verification

Proves the physical reduction failure and admissible simultaneous opening-rest impulse at this event. Does not prove later flight/recapture, a full stroke, calibration or realtime performance. Root is implementing retained idle coordinates and sparse energy contraction. The audit worktree and owned processes were cleaned; evidence remains in ignored output.

## Round outcome

Reject the fixed-idle-coordinate reduction at impacts. Accept the bounded sign and free-rest response calculation; retain the newly exposed degrees of freedom before full-cycle acceptance.
