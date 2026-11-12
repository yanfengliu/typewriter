# Review 0: implementation

## Target

Integrated tutorial commit d08b49da6207d13767ad1f4c1ca00677a885d598 against ff0fa5d8d5b5155739d7abec298b7327456d8993.

## Reviewers and coverage

Independent Codex reviewer tutorial_review (gpt-6-astra, xhigh), read-only source review and a model-level input lifecycle probe. The scene implementer did not perform this review. Repository links below are normalized to relative paths. Browser checks and runtime gates were performed separately by the implementation owner.

## Reports

### Codex tutorial_review

Reviewed `d08b49da6207d13767ad1f4c1ca00677a885d598` against `ff0fa5d8d5b5155739d7abec298b7327456d8993`.

- **F0 — P2: Preserve pending pointer-key releases when opening the tour.** [main.ts:104](../../../../src/main.ts#L104) suppresses releases as well as presses while the tutorial is active. Opening within the on-screen key’s 100 ms release window sets `active = true` before `scene.setTutorial()` calls `releasePointerKey()`, so that cleanup callback is discarded. `releaseAll()` only tracks hardware keys, leaving the clicked key in `BufferedTypewriter.held`. Its next press after closing is silently ignored. A short Node probe using the actual buffered model confirmed two intended `a` clicks produce only one impression. Allow release callbacks while blocking new presses.
- **F1 — P3: Ignore shortcuts originating in the nested source guide.** [tutorial.ts:111](../../../../src/tutorial.ts#L111) also receives keyboard events bubbling from `#how-dialog`. ArrowLeft/ArrowRight therefore change the underlying chapter and restart playback while the source guide is open. Restrict tutorial shortcuts to events belonging to the tutorial dialog itself.
- **F2 — P3: Preserve the restored writing camera on close.** [main.ts:143](../../../../src/main.ts#L143) calls `setView(view)` immediately after the scene restores its saved camera and target. That schedules the default view again, discarding the user’s pre-tour orbit or zoom. Restore paper visibility and control state without resetting the scene camera.

Beyond these findings, source inspection found no material defect in demonstration-paper isolation, queue preservation, chapter sequencing, assembly restoration, or material/texture disposal. Inspection included unchanged code outside the diff, particularly `src/buffered-typewriter.ts:32–55` and `src/paper.ts:71–94`.

`git diff --check` passed. This review did not independently rerun the reported 34 tests or Pages build, launch a browser, or validate rendered layout and accessibility behavior. F1 and F2 are source-traced findings; F0 additionally has the model-level reproduction. No files were edited and no persistent processes or artifacts were created.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Pointer release suppressed during entry | Accepted; owner reproduced held a and a skipped repeat in the browser | 5dcc0dc permits releases while blocking presses; actual mouse check clears held state and prints the first repeat |
| F1 | Nested source-guide shortcuts reach tour | Accepted; shortcut ownership belongs to the nearest dialog | 5dcc0dc adds a nearest-dialog guard; browser arrows and Space leave the underlying chapter and progress unchanged |
| F2 | Closing resets prior camera composition | Accepted; the scene already restores the saved camera | 5dcc0dc restores paper visibility without another camera request; before/after captures preserve the orbited composition |

## Verification

The owner ran all 34 tests and the Pages production build before both the reviewed revision and repair commit; both passed. The existing nonfatal large-chunk advisory remains. Browser checks covered seven chapters, six assembly labels, exact timeline contact at 46%, preserved paper and 42 queued keystrokes, pointer suppression, resumed typing with spaces, paper-view restoration, desktop and 390 × 844 layouts, reduced-motion playback, pause, reassembly, nested source notes and Escape/focus behavior. One early source-guide check was interrupted by development reload; a later check exposed native modal nesting and was repaired before the reviewed commit. A synthetic pointer probe produced an expected browser pointer-capture exception because the synthetic pointer was not active; the repaired release path was verified with a real mouse event instead. Camera captures differ in the DOM focus caption, so they were inspected visually rather than claimed byte-identical.

## Round outcome

Three findings accepted and repaired at 5dcc0dcf38ba85f0d57d34aeacf23a9a88528ba1. Scoped independent repair verification is recorded in the next round.
