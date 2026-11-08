# Exact-state energy cache review

## Target

SnapshotA0A093D83FA40577E1463936A4996F42E8F8B3509F1AEB66ADBDAAC07925715B. The optimization reuses complete local energy evaluations when the full coordinate vector is unchanged, avoiding repeated construction of local cache keys.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Exact-snapshot read-only agent review of dense inputs, callback failures, invalid inputs, cache clearing and output isolation; not dual-CLI.

## Reports

Primary output/finite-contact-review/energy-state-cache/report.md, SHA256A6E8CC40B98F12C3F214AAEE228D45CE556A49AAE049E43E10ABBC50DA5F0171. The original source, reproduction and passing and failing checks remain immutable.

## Findings and disposition

Changes requested for ESC1, P2: both coordinate validation using Array.some and the new equality test using Array.every skip missing array elements. Warming at a valid dense vector, deleting a selected element while preserving length, then querying any energy API returns stale finite data. The predecessor and cold/cleared/disabled new cache reject the same input. This is invalid-input acceptance dependent on cache history.

## Verification

All51 frozen hashes match and18 focused tests pass. Independent dense-input comparisons, array mutation/reordering, returned-data isolation, multi-term failure atomicity, disabled caching and clearing pass. The retained eight-mode predecessor/candidate reproduction isolates the warm-cache regression. Original author benchmarks show modest query-time savings and exact reconstructed microflight outputs; those results do not waive ESC1 or establish realtime performance.

## Round outcome

The original cache optimization is rejected pending indexed validation and regression coverage. No geometry, force law or solver tolerance changed. The followup repair has its own exact review record; this rejection remains preserved.
