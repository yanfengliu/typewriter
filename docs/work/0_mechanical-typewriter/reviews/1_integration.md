# Review 1: integration

## Target

Commit 0b7b39d9036306271c862075ea25a2f0bef0d9d0; repairs for F0 and F1 in src/paper.ts and src/main.ts, tests/paper.test.ts, and the README limitation.

## Reviewers and coverage

Independent Codex gpt-6-astra reviewer at xhigh read the pinned committed bytes and executed the repaired callbacks and persistence tests in memory. Root separately exercised two actual headless Chrome tabs and raycast clicks on the rendered Shift and A keycaps.

## Reports

### Codex gpt-6-astra

Targeted re-review of commit `0b7b39d9036306271c862075ea25a2f0bef0d9d0`: **both findings resolved; no remaining material findings in the repair scope.**

- **F0 — resolved.** `paper.ts:77` compares storage against the last successfully loaded/saved value before writing. Conflicts permanently block that instance's saves, warn the user, preserve existing storage, and retain local pages for export. All five persistence regression tests passed independently using the committed source.
- **F1 — resolved.** `main.ts:99` tracks pointer Shift separately and consumes it after the clicked character's contact/release. Independent execution of the committed callbacks confirmed that Shift survives automatic pointer release, produces `A`, then permits lowercase `b`; a held physical modifier remains active during subsequent pointer typing.

The remaining exactly simultaneous writer race is explicitly documented in `README.md:32`. This fix provides optimistic conflict detection, not atomic multi-tab coordination; it resolves the reproduced stale-tab overwrite.

Review used pinned committed bytes and in-memory execution. No files changed, artifacts retained, or browser processes launched.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
| --- | --- | --- | --- |
| F0 | Stale tab overwrites stored ink | Resolved: conflicting writes are blocked and local pages remain exportable. | 0b7b39d; five regression tests and actual two-tab test. |
| F1 | Clicked Shift is released too early | Resolved: pointer modifier survives until the selected character contacts the paper. | 0b7b39d; independent callback reproduction and actual raycast clicks. |

## Verification

All 20 tests and the production build passed. Browser checks confirmed unchanged shared storage when an older tab tried to save, visible conflict warning, uppercase A from Shift then A pointer clicks, jam recovery via Escape, and valid ink coordinates. The production bundle rendered successfully with no runtime page errors, accepted physical keyboard typing, persisted 10 impressions at column 12, and exposed no development hook. Hardware rendering used the RTX 4090 through ANGLE/D3D11. PNG download produced a valid 1700 by 2200 canvas export. Build retains a non-fatal 500 kB chunk-size advisory; the main bundle is approximately 149 kB gzip.

## Round outcome

Both accepted findings are repaired and independently checked. No material findings remain. Physics parameters and paper deformation remain intentionally illustrative, and storage conflict protection is optimistic rather than atomic, as documented.
