# Review 0: implementation

## Target

Typewriter commit 8212b714607475b68a9956e41bff7db0ea1f43a8 against d3e194b20632b1c8f3420690b99d0c239a7c67f5. Scope: causal lessons, tutorial UI/CSS, SVG mechanism diagrams, tutorial regressions, and existing main/scene integration boundaries.

## Reviewers and coverage

Independent causal_review agent, gpt-6-astra at xhigh as pinned by the fleet review runbook. Read-only source review and five retained desktop/mobile screenshots. No browser or test rerun by the reviewer; root owns rendered interaction checks. Screenshots preceded the final label/transparency adjustment, whose committed code was inspected.

## Reports

### causal_review

Reviewed exact commit 8212b714607475b68a9956e41bff7db0ea1f43a8 against d3e194b20632b1c8f3420690b99d0c239a7c67f5.

One actionable finding: [P2] Reverse the escapement motion arrow. src/mechanism-diagram.ts:154 draws escape-turn clockwise, down the wheel's right side, while line 275 rotates the wheel counterclockwise through -advance * 30. Reproduce in lesson 5 by playing or scrubbing through 52–80%, or holding Space at 67%. The arrow contradicts the moving mechanism precisely where the lesson teaches how leftward carriage travel relates to wheel rotation. Reverse the arrow path; retain the counterclockwise wheel movement.

No other material findings in this pass. The connected lever geometry, ink-before-spacing sequence, persistent ink, basket alignment, and return/feed sequence support the causal explanation. Numbered poses remain inside their narrated intervals. Reduced-motion mode starts paused and retains direct access to each teaching moment.

Integration review included unchanged code outside the diff: src/main.ts:293 pauses live machine stepping during the tutorial; src/scene.ts:822 saves/restores camera and materials while keeping tutorial ink separate from real paper. No newly introduced queue, paper, dialog, focus, or camera regression identified.

Limits: read-only source review and inspection of five supplied desktop/mobile screenshots; no browser or test rerun. Screenshots predate the disclosed label/transparency adjustment, whose committed code I inspected. No files changed or task-owned browser processes created.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | P2 escapement arrow contradicts wheel rotation | Accepted: a causal teaching diagram must depict the same direction in motion and annotation. | Reverse the path in d61551e3d2f3e1a0fe0a4dd72f2bfec979d0e7e4; scoped independent review in round 1. |

## Verification

Root ran all 36 tests, the Pages build, whitespace/work-document checks and diff secret scan. Headless Chrome at 1440 × 1000 and 390 × 844 verified all distinct close-ups, numbered holds, opening view transitions, feedback, optional 3D/explosion, nested source guide, reduced motion, and preservation of real paper plus 24 pending input events. After closing, all characters in the zero-delay input burst printed in order. WebGL-disabled fallback retains the SVG lesson and disables only the 3D view. Browser console reported zero errors or warnings. The existing Vite large-chunk advisory remains nonfatal.

## Round outcome

One material finding requires repair; no other material findings. The target is retained in Git history. Follow-up is recorded separately in round 1.
