# Solved lesson recorder and narrative contract acceptance

## Target

Exact commit 44e32930756f0bd79314501630343c3dac5d802d, parent 051c17cf8adf8a92c3e9033d0103b9de934c2c3a. Scope is four new files: src/lesson-recording.ts, src/connected-lessons.ts and their two tests. No tutorial UI or ConnectedMachine integration is claimed.

## Reviewers and coverage

Independent mechanism_audit, gpt-6-astra, xhigh. Reviewed immutable solved captures, exact substep event timestamps, simultaneous ink ordering, retained command ownership, budgets, disposal, replay/explosion semantics and source-derived narrative ordering. Root retains the exact report and probe outputs.

## Reports

Retained output/lesson-review/report.md, SHA256 4EE7591F4384A798DBF018149AFF33E62332A1E316636C586B920B1D40DD88BF, with the four original Git blobs, author proof, independent probe groups, logs and hash manifest.

## Findings and disposition

No material findings in the bounded recorder contract. Narrative distinguishes loose-dog release from the actual roll catch; it allows measured roll capture before, at or after print and makes no stationary-paper claim. Missing or ambiguous events fail explicitly. Whole-machine event production and UI wiring remain root-owned integration work.

## Verification

Independent 16 focused tests and eight adversarial groups pass. Coverage includes aliased source mutation, dispatch-time simultaneous ink, nonzero clocks, refused nested commands, substep/end-state ordering, swallowed sink errors, cleanup aggregation, explosion/resume ink prefixes, invalid data and source precedence. A real PlatenMechanism fixture records 95 periodic frames over 1,444 steps with no invented contact timestamps. Author passed 181 full tests and build; reviewer did not repeat the full gate. No browser/server created; review checkout removed and owned processes audited clean.

## Round outcome

Accept the four-file recording milestone. Proves its tested immutability, ownership, event/replay and narrative contracts. Does not prove complete real-machine events, whole-machine recording budgets, actual tutorial/UI behavior, mobile rendering or machine physics. M6 remains in progress.
