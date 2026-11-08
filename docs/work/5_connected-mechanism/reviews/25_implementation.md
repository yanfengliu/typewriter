# Retained-bank direct-rod contact review

## Target

Frozen43-file helper handoff, manifest83BCA8102489791ADD8BBF0272DF7FC41D36ABA97F94B634BDB1A9B2615BE068. New rod-contacts.ts evaluates both longitudinal ends of each existing rigid direct-hook slide at independently mapped key/bar coordinates. No rod route, support or source dimension changed.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Exact-snapshot read-only agent review, independent pose and derivative comparisons, mapping/cache/domain probes and synthetic simultaneous impulse controls. Not dual-CLI.

## Reports

Primary output/finite-contact-review/rod-contact/report.md, SHA256440E36C282BEBFAA388ED08A993741ABB5142513AB29D80B14E5235E2349167A. Frozen inputs, scripts and successful and failed fixture evidence are retained.

## Findings and disposition

Accept the bounded helper; no blocking finding. Hook and opposite slide-end gaps, gradients and curvature have opposite signs as required. The scalar distance domain does not itself enforce the transverse rod-pose frame's validity; the full pose/energy caller remains responsible for that separate domain. No endpoint reachability or whole-stroke claim follows.

## Verification

All43 frozen hashes match. The author's225 all-bank poses pass. Independent135 seeded poses across45 keys/five shuffled coordinate mappings and1350 curvature checks agree with the existing analytic jets within6.67e-16. Ninety contact IDs are unique; sparse maps, cache isolation, invalid coordinates and four non-X/reversed hinge-axis controls pass. Two explicitly synthetic51-coordinate endpoint impulses match independent momentum solutions within1.74e-18 in velocity and dissipate expected energy. The author's original coarse finite-difference failure is retained with its six-spacing convergence/roundoff study; the final test uses a finer oracle and tighter bound. A reviewer optional endpoint scan found no endpoint in its assumed interval; it remains a failed fixture, while the replacement synthetic test makes no physical reachability claim.

## Round outcome

This proves the reviewed local contact functions and coordinate mapping for the unchanged rod definitions. It does not prove admissibility of every rod pose, whole-bank dynamic contacts, common-assembly clearance, endpoint reachability or a complete physical typing cycle. Review worktree and owned processes were cleaned.
