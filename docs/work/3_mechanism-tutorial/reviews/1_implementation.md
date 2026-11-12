# Review 1: implementation

## Target

Repair commit 5dcc0dcf38ba85f0d57d34aeacf23a9a88528ba1 against d08b49da6207d13767ad1f4c1ca00677a885d598. Scope is the three accepted findings from round 0.

## Reviewers and coverage

Independent Codex reviewer tutorial_review (gpt-6-astra, xhigh), read-only source and model-level lifecycle probe. Browser checks and runtime gates were performed separately by the owner.

## Reports

### Codex tutorial_review

Scoped repair review of `5dcc0dcf38ba85f0d57d34aeacf23a9a88528ba1` against `d08b49da6207d13767ad1f4c1ca00677a885d598`: **F0, F1 and F2 are resolved. No new findings in this repair scope.**

- **F0:** `src/main.ts:104` now blocks only presses during the tutorial. Pending pointer releases reach the existing release logic. A model-level lifecycle probe confirmed that tutorial presses remain blocked and the first repeated key after closing prints correctly.
- **F1:** `src/tutorial.ts:113` checks the event target’s nearest dialog, excluding shortcuts from the nested source guide.
- **F2:** `src/main.ts:143` restores paper visibility and sizing without resetting the camera. The existing scene cleanup restores covers, materials, camera and target independently (`src/scene.ts:853–876`, inspected outside the repair diff).

`git diff --check` passed and the working tree was clean. The reported 34 tests, Pages build and browser reproductions were not independently rerun. This review used source inspection and the short model probe; no files were edited or persistent resources launched.

## Findings and disposition

F0, F1 and F2 are resolved by the committed repair. No new findings or dissent.

## Verification

The owner ran all 34 tests and the Pages build after the repair; both passed. Actual mouse input held a before opening the tutorial and left no held key afterward; the first repeated key printed. Source-guide arrows and Space did not change the underlying chapter or paused progress. The prior writing orbit was visually preserved. See round 0 for the broader browser coverage and its bounds.

## Round outcome

Accepted at the repaired revision. No unresolved material findings remain; publication and the live-site smoke check follow.
