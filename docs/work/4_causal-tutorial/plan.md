# Teach the causal mechanism of a typewriter

Status: active
Owner: Codex
Created: 2026-11-07
Updated: 2026-11-07

## Problem and outcome

The owner found the assembly tour decorative: after watching it, a learner still could not explain how the machine works. Replace its default view with a connected causal demonstration, so a learner can describe energy transfer, ink contact, metered spacing, case selection and line return.

## Scope

Seven chapters with large animated mechanism close-ups, synchronized cause/effect narration, selectable teaching moments, retrieval questions and a concise explanation to retell. Retain the 3D model as optional spatial context. Preserve live typing, the input queue, ink, storage, mobile and reduced-motion support. No new dependency or persistent format.

## Approach

Use the existing independent pose sampler for both SVG close-ups and optional 3D. The opening now performs a real illustrative stroke instead of exploding parts. Fixed pivots, connected levers, contact layers, paper travel and escapement holds are visible. Teaching schematics simplify geometry and slow timing; they do not claim to be a calibrated reconstruction. Primary references: U.S. Navy Basic Machines chapter 12, the Royal 1955 maintenance manual's basket shift, and the USPTO full-drop escapement definition. Root owns lessons/UI/tests/integration; causal_diagrams owns only the SVG module and its CSS in an isolated worktree. A fresh independent reviewer checks the integrated committed revision.

## Acceptance criteria

- [ ] A complete opening stroke visibly connects pressing, printing, spacing and reset without disassembly.
- [ ] Focused animations show the contact sandwich, separate energy sources, one-space arrest, two slug faces and both return motions.
- [ ] Selecting a teaching moment shows a pose matching its cause/effect explanation; each chapter offers explanation feedback.
- [ ] Headless desktop and mobile checks verify readability, controls, reduced motion, source modal and unchanged real writing/queued input.
- [ ] Tests, build and independent review pass; the improved tutorial is verified on GitHub Pages; task resources are removed.

## Implementation steps

- [x] Research and agree the shared pose contract.
- [x] Implement causal lessons and bounded SVG module.
- [ ] Verify the rendered teaching sequence and isolation, then obtain independent review.
- [ ] Publish, check the live site and close the work record.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
