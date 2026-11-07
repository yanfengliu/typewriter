# Preserve fast keyboard input

Status: active
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

- [ ] Zero-delay and overlapping key bursts print every supported character once, in order, including repeated letters and spaces.
- [ ] Shift, ribbon, force, returns, backspaces and feed actions retain their intended values and ordering.
- [ ] Slow motion and margins retain pending input, and loading a sheet cannot silently cancel it.
- [ ] Browser keyboard tests, all automated tests, build and independent review pass; deliver to main and clean task resources.

## Implementation steps

- Root implements and verifies the isolated change from e2d10ee.
- An independent reviewer checks input ordering and lifecycle edge cases against the committed revision.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
