# Teach the causal mechanism of a typewriter

Status: complete
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

- [x] A complete opening stroke visibly connects pressing, printing, spacing and reset without disassembly.
- [x] Focused animations show the contact sandwich, separate energy sources, one-space arrest, two slug faces and both return motions.
- [x] Selecting a teaching moment shows a pose matching its cause/effect explanation; each chapter offers explanation feedback.
- [x] Headless desktop and mobile checks verify readability, controls, reduced motion, source modal and unchanged real writing/queued input.
- [x] Tests, build and independent review pass; the improved tutorial is verified on GitHub Pages; task resources are removed.

## Implementation steps

- [x] Research and agree the shared pose contract.
- [x] Implement causal lessons and bounded SVG module.
- [x] Verify the rendered teaching sequence and isolation, then obtain independent review.
- [x] Publish, check the live site and close the work record.

## Outcome

Published at [Atelier](https://yanfengliu.github.io/typewriter/) through The mechanism. The integrated implementation is 8212b714607475b68a9956e41bff7db0ea1f43a8, with review repair d61551e3d2f3e1a0fe0a4dd72f2bfec979d0e7e4. Publication revision 7ae00c996b65615c6f851dd885cb91bf89d4dc63 passed [Pages run 42429019770](https://github.com/yanfengliu/typewriter/actions/runs/42429019770), including all tests, production build and deployment. The live page loaded the expected index-Dmtjf2Sl.js asset. All 36 tests, local production builds, whitespace, work-document and relevant diff secret checks passed. The known nonfatal Vite large-chunk advisory remains.

[Initial independent review](reviews/0_implementation.md) found one contradictory wheel arrow. The [repair review](reviews/1_implementation.md) confirmed its resolution and the associated opening/return alignment improvements. Root inspected full-resolution diagrams through actual controls on desktop and mobile: connected linkage, visible contact layers, spring-driven spacing and arrest, two-face shift, and paper-feed/carriage-return motions. The optional 3D view and disassembly remain available. A WebGL-disabled check confirmed the main SVG lesson still works.

Headless interaction checks covered selectable poses, playback/scrubbing, explanation feedback, nested source-guide Escape/focus, reduced-motion stepping and explicit playback. The local tour preserved 24 pending keystrokes and the real sheet across all chapters; closing printed the entire burst in order. Live checks at 1440 × 1000 and 390 × 844 confirmed no horizontal overflow, permanent ink unchanged during the tutorial, and fast typing before and after it. An initial live harness check sent Space while the restored tutorial opener had keyboard focus, which correctly reopened that button's dialog; the corrected check refocused the writing canvas before typing and passed. The live tab reported zero console errors or warnings.

The owned headless browser, automation daemon, hidden preview server and their child processes were closed through the supervisor's finally path and audited absent. Selected final screenshots remain in the primary checkout's ignored output/playwright/causal-tutorial folder; redundant task captures, profile and worktrees are removed at closure. The teaching diagrams intentionally simplify links and omit the connecting gear train in the escapement close-up, with visible disclosure. Learning outcomes were checked through causal content and retrieval prompts, not a human classroom study.
