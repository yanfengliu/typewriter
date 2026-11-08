# Exact-state energy cache validation repair

## Target

Repaired52-file snapshot4EB58C0786E408D3C97CD4C97D640BC405C240AA43CFF8162F9F2973E636611B, following the rejected cache snapshot in review27. Only implementation, cache regressions and the new author test log differ.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Original failure replay and exact repaired-snapshot cache contract checks. Agent review, not dual-CLI.

## Reports

Primary output/finite-contact-review/energy-state-cache-repair/report.md, SHA256FC1AC91E8891CDEA409F1075F7C7B309DF4368BDA6579AB9FD7E41BA395C2737. Both original rejection and repaired source/evidence are preserved separately.

## Findings and disposition

Accept the bounded optimization; ESC1 is closed. Indexed validation now reads every coordinate and velocity component before callbacks or cache reuse, including array holes. Complete-state installation, copied cache keys, arithmetic and clearing remain unchanged. No approximation or tolerance relaxation was introduced.

## Verification

All52 hashes match. Three repaired cache tests pass. Independent dense outputs remain bitwise equal to the pre-optimization implementation across capacities0/1/2/32, copied/mutated/reordered vectors, output-buffer mutation and callback failure/recovery. Sixty-three dimension/position/capacity/cache-state combinations produce378 invalid queries rejected before callbacks with unchanged cache references. The unchanged original finding detector now fails its old expected-bad assertion because rejection is correct; that replay is retained separately from the positive repair checks. Author19-test gate passes; the reviewer did not duplicate the unchanged suites, timings or microflight.

## Round outcome

This proves the repaired cache contract and preservation of tested dense numerical outputs. It does not prove actual mechanism geometry, an operating cycle or realtime speed. Earlier timings belong to the pre-validation-repair snapshot and remain limited observations. Review worktree and owned processes were cleaned.
