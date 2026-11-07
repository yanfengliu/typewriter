# Preserve fast keyboard input

Status: complete
Owner: Codex
Created: 2026-11-07
Updated: 2026-11-07

## Problem and outcome

The user reports lost letters when typing quickly. Retain supported keyboard and pointer input while the mechanical simulation completes each stroke, with no changes to existing ink.

## Scope

Add an input buffer, integrate queue status and lifecycle controls, and add behavioral regressions. Preserve the mechanical model, hard margins, existing paper format, and current mobile capabilities. No new dependency or deployment.

## Approach

Keep the raw mechanics independently testable; dispatch buffered input only when its full cycle is ready. Capture modifiers and options when input arrives, preserve control ordering, and let manual return/backspace release queued overflow at a hard margin. Protect unprinted work with a pending count and unload warning. The queue is transient and does not change the saved-paper format.

## Acceptance criteria

- [x] Zero-delay and overlapping key bursts print every supported character once, in order, including repeated letters and spaces.
- [x] Shift, ribbon, force, returns, backspaces and feed actions retain their intended values and ordering.
- [x] Slow motion and margins retain pending input, and loading a sheet cannot silently cancel it.
- [x] Browser keyboard tests, all automated tests, build and independent review pass; deliver to main and clean task resources.

## Implementation steps

- Root implements and verifies the isolated change from e2d10ee.
- An independent reviewer checks input ordering and lifecycle edge cases against the committed revision.

## Outcome

Implemented and verified at 64c65783ae1d7e9c36f5b30a2fbfdd30fee7e011; delivered with review records to main and origin/main at e65919b after explicit owner approval. All 31 tests and the production build passed. Headless Chrome preserved every character in a 51-character zero-delay burst, ordered return/backspace overstrikes, slow-motion typing and clicked Shift. New-sheet protection and archival passed; the pending-input unload handler prevented a cancelable event. Inspected fixed, orbited and paper views at 1440 × 1000; zero browser errors or warnings. [Independent review](reviews/0_implementation.md) found no material issues. The main checkout's production build was refreshed successfully. GitHub reported no workflow runs; this repository has no CI workflow. The owned browser, server, daemon and child processes were closed and audited; their temporary profile and runtime files were removed. Selected visual evidence remains under ignored output/playwright/buffered-typing in the primary checkout.

The mechanical model still controls contact and permanent ink. Overflow waits at a hard margin for Enter, Backspace or a fresh sheet; it does not auto-wrap. The queue is transient, with an unload warning rather than a persistent-format change. Native mobile keyboard support remains outside this change.
