# Review 0: implementation

## Target

Commit 6207e000a1d6a9c96bc217170d2559cbf215edd0 in typewriter; all src modules, README and mechanics tests.

## Reviewers and coverage

Independent Codex reviewer, gpt-6-astra at xhigh, read actual source and performed in-memory reproductions. Claude's pinned review lane could not authenticate because its OAuth token had expired; that lane abstained. Root separately performed rendered, hardware-accelerated, headless Chrome checks.

## Reports

### Codex gpt-6-astra

Reviewed commit `6207e000a1d6a9c96bc217170d2559cbf215edd0`, read-only. Scope covered mechanics, permanent compositing, persistence/archive, keyboard and pointer input, scene disposal, README claims, and existing tests.

- **F0 — P1: A stale tab can silently delete saved writing and archives.** `paper.ts:69` unconditionally replaces the shared storage entry with that tab's snapshot. `main.ts:275` saves on hiding or unloading, so the stale tab need not receive any typing. Reproduced with two `PaperStore` instances sharing mocked storage: A wrote `a` and archived its sheet; B's subsequent idle save replaced storage with an empty sheet and empty archive. Reload loses A's saved content. Add conflict detection that preserves the existing stored session and keeps conflicting local pages available for download. The coordinator has accepted this finding.
- **F1 — P2: Clicking the displayed Shift keys cannot modify another clicked key.** `scene.ts:512` always releases the previous pointer key before pressing the next. Releasing Shift calls `main.ts:105`, which clears the modifier before the next character is selected. Holding the pointer on Shift does not help: activation occurs only on pointer release. Reproduced the actual callbacks in memory: click Shift, then click `a` before its automatic release → `shifted: false`, printed `a`. Physical keyboard Shift works; the advertised clickable Shift controls do not. Keep pointer Shift independently latched until the next character, or support holding modifier pointers separately from character pointers.

All 15 existing mechanics tests passed when executed from unmodified source using in-memory transpilation. The persistence and modifier reproductions also used in-memory execution; no browser or visual verification was performed in this review. Other inspected paths—contact before escapement, jam recovery, permanent ink stamping, paper coordinates, bounded restoration, and normal scene disposal—yielded no additional material findings. The documented illustrative physics limits were not treated as defects.

No files were edited or artifacts retained. The final status check remained clean at the pinned commit.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
| --- | --- | --- | --- |
| F0 | Stale tab overwrites current storage | Accepted: permanent ink must not disappear through an idle tab save. | Add conflict detection and regression tests; narrow re-review required. |
| F1 | Pointer Shift cannot modify clicked keys | Accepted: clickable controls must support their labeled operation. | Add independent pointer modifier latch; real pointer test and re-review required. |

## Verification

The source commit passed TypeScript, production build and 15 mechanics tests. Root verified real keyboard input, layered overstrikes, exact reload restoration, red ribbon, double spacing, slow motion, native-resolution paper zoom and PNG download. Review identified missing multiple-tab persistence and pointer-modifier coverage.

## Round outcome

Two material findings accepted for repair before delivery. This round does not approve the later fixes.
