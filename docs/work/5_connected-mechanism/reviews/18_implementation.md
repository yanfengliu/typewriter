# Finite-axis smooth-domain repair review

## Target

Exact contact-solver repair attempt7, commit3456e9891a86b9929a116923dff68990bc456a64, parent0a16882873f9dd70f9372a1991e59d04591ac57c. The owner authorized attempts6–8; only attempt8 remains after this rejected candidate.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Agent review, not dual-CLI. Isolated read-only exact revision, original counterexamples unchanged, additional domain-contract and seeded continuation-horizon probes.

## Reports

Primary checkout output/finite-contact-review/repair-3456e98/report.md, SHA256104764F7E5EA40910F56C6FEC76BE05952CF23118F8B529D05DB3011F93B22C0. Exact source blobs, original/adversarial probes and caught failure details are retained.

## Findings and disposition

FCR-1 and FCR-2 remain closed; the original FCR-3 frozen-axis endpoint/interior failure is repaired. Hold overall acceptance for two findings. FCR-4: default numerical contact/mass/potential derivative stencils can evaluate outside smoothDomain because only RK/dense states are guarded. A separated logarithmic gap receives negative q before the earlier feature boundary, while the analytic-derivative control succeeds. Either guard every stencil or explicitly validate required derivative providers before stepping; do not swallow callback errors. FCR-5: reconstructing remaining duration after a feature boundary can round the inner deadline one ulp beyond the caller's original deadline, causing a strictly bounded force callback to fail. Preserve the absolute deadline or round remaining duration safely; do not relabel an already evaluated future state.

## Verification

Forty focused tests pass, as do the original336 and additional240 coincidence cases and compensation/history/rollback probes. The seeded finite-path audit completes77/80 paths with no mechanical discrepancy; three fail the exact outer-horizon assertion. The original FCR-3 endpoint now returns the incoming state with no impulse/support/loss. Author196-test/build results were not duplicated. Review worktree and task processes were cleaned.

## Round outcome

Reject3456e98 as a whole pending FCR-4/FCR-5. This round proves the tested finite-axis repair and preserved prior numerical behavior, not arbitrary derivative-domain safety, full adapter acceptance or a source-key typing cycle. Root keeps accepted0a1688 in integration while final authorized attempt8 is prepared.
