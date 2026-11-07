# Teach the typewriter with an exploded 3D tour

Status: active
Owner: Codex
Created: 2026-11-07
Updated: 2026-11-07

## Problem and outcome

Add an interactive tutorial explaining the existing manual typewriter through animated exploded views and focused mechanism demonstrations, then publish it to the existing GitHub Pages site.

## Scope

Seven guided chapters, assembly separation, labeled 3D components, focused cameras, playback and timeline controls, independent demonstration paper, accessible dialog and responsive/reduced-motion behavior. Preserve live typing, queue ordering, saved sheets and existing mechanical behavior. No new dependencies or persistence format.

## Approach

Reuse the existing procedural model and renderer in a fullscreen native dialog. A separate pure pose sampler drives slow, scrubbable teaching animations. Exploded offsets are an explanatory diagram; real writing remains governed by the mechanical model. Live physics pauses while the tour is open and resumes with the queue intact. The tutorial uses its own canvas and texture. Research is grounded in Basic Machines chapter 12, the Royal 1955 service manual's basket-shift section, and the USPTO full-drop escapement definition; source links remain in the guide.

## Acceptance criteria

- [x] All seven chapters show readable explanations, correct mechanical sequencing and distinct component focus.
- [x] Exploded assembly animation, playback, scrubbing, orbit, separation and reassembly work through real controls.
- [x] The tour preserves existing ink and queued typing; keyboard and pointer input cannot write to the real sheet during the tutorial.
- [x] Desktop, narrow viewport, keyboard focus, Escape and reduced-motion behavior pass headless browser checks.
- [ ] Tests, production build and independent review pass; deploy to Pages and verify the live tutorial; remove owned temporary resources.

## Implementation steps

- Root owns tutorial poses, UI, integration, tests, documentation and delivery.
- tutorial_scene owns scene.ts assembly grouping, teaching texture, labels, cameras and restoration; no other files.
- A separate read-only reviewer checks the committed integrated revision before delivery.

## Outcome

Implemented at d08b49da6207d13767ad1f4c1ca00677a885d598 and repaired after independent review at 5dcc0dcf38ba85f0d57d34aeacf23a9a88528ba1. All 34 tests and the Pages build pass. Headless checks cover seven chapters, exploded labels, contact sequencing, playback, scrubbing, pointer and keyboard isolation, preservation of 42 queued keystrokes, paper-view restoration, mobile layout, reduced motion, source-guide focus and Escape. [Initial review](reviews/0_implementation.md) found a pending pointer release race plus two small dialog/camera issues; all three were repaired and browser checked. Scoped repair review and publication remain.
