# Carried rigid-body energy review

## Target

Five-file helper snapshot, manifest08CD69663C3935B1327135AE34CE618B7D9863D358C141AD8EC53612349D0C04. The child hinge moves with its parent; relative rotation is independent. Geometry, springs and the ordinary typing model are not connected to this helper yet.

## Reviewers and coverage

Independent material_review, gpt-6-astra, xhigh. Exact-snapshot agent review with independent quaternion solid quadrature, point-acceleration inertia, finite differences, coordinate scattering and cache reordering. Not dual-CLI.

## Reports

Primary output/carried-rotor-review/review.md, SHA25668713027D469E514906839278604C0280B5500CAA02EBBBA0E7BB16FF611489D. Frozen sources, scripts, successful checks, signed-zero harness failure and cleanup evidence are retained.

## Findings and disposition

Accept the bounded helper; no material findings. Caller must provide a unit common axis, actual child mass, inertia about its COM along that axis and immutable definitions. Parent hardware must be counted separately. The helper retains moving-pivot translation, composed angular velocity and cross inertia; it does not constrain the child's relative angle or supply a return law.

## Verification

All five hashes match. Independent checks pass180 mass/gravity/derivative states and80 Christoffel states across five axes and all four sign pairs, plus noncontiguous coordinate mapping/cache order. Maximum errors are5.68e-18 in mass,4.34e-19 in potential,1.41e-15 in gradient,6.75e-14 in derivatives and1.96e-14 in inertial force. Two author tests and three reviewer tests pass across recorded runs. A reviewer assertion initially distinguished negative zero from arithmetic zero; the original failure remains and the corrected assertion passes.

## Round outcome

This proves the reviewed parallel-axis carried-body energy calculations. It does not prove corrected common-lift solids, source geometry, spring parameters, contact feasibility, complete assembly clearance or any operating cycle. Disposable review worktree and owned processes were cleaned.
