# Interactive mechanical typewriter

Status: complete
Owner: Codex integration
Created: 2026-11-07
Updated: 2026-11-07

## Problem and outcome

A usable 3D manual typewriter that accepts physical keyboard input, displays moving mechanisms, and deposits permanent ink on a simulated sheet.

## Scope

Three.js and TypeScript browser app; procedural machine geometry, reduced physical mechanism model, permanent textured paper, local sheet retention, sound, inspection views and source notes. This is an illustrative composite portable typewriter, not a calibrated historical replica or a finite-element paper solver. No deployment is requested.

## Approach

Separate deterministic mechanics from renderer and ink surface. Follow the primary-source sequence of key linkage, typebar impact, ribbon lift, and escapement. Use fixed time steps, spring forces, angular inertia, contact restitution and hard carriage detents. Use a constrained sheet path around a platen. Retain immutable impression records instead of editable text. Build and verify headlessly in an isolated worktree based on a918243.

## Acceptance criteria

- [x] Physical keys and clickable 3D keys create ink at impact; the fixed printing point and moving carriage agree.
- [x] Backspace preserves ink, overstrikes accumulate, margins do not wrap, return feeds paper, and shift selects uppercase.
- [x] Inertia, spring return, collisions/jams, and pressure-dependent impressions are modeled and tested.
- [x] Desktop and mobile layouts, alternate views, source notes, paper archive and PNG export work through real browser controls.
- [x] Build, 20 tests, independent review, and secret scan pass. No CI workflows are configured. Task-owned browser and server process checks are clear; only selected screenshots and usable build/dependencies are retained.

## Implementation steps

- Mechanics owner: mechanics agent; src/mechanics.ts and behavioral tests.
- Scene owner: studio_scene agent; src/scene.ts and 3D interaction.
- Writing room owner: writing_room agent; UI, paper and audio modules.
- Integration owner: root; shared contracts, research, dependencies, acceptance, review, documentation and Git delivery.

## Outcome

Implemented and merged/pushed to main through db1ba3a; final reviewed code is 0b7b39d9036306271c862075ea25a2f0bef0d9d0. [Review 0](reviews/0_implementation.md) found stale-tab data loss and ineffective clickable Shift; [review 1](reviews/1_integration.md) independently verified both fixes. All 20 tests and TypeScript/production build pass. Headless Chrome checks covered real keyboard and raycast inputs, permanent overstrikes, carriage return, red ribbon, double spacing, slow motion, jam recovery, zoom, PNG export, exact reload restoration, two-tab conflicts, desktop/mobile layouts and arbitrary camera orbit. The built app rendered without runtime errors on hardware WebGL and contains no development inspection hook. No GitHub Actions runs or workflow configuration exist for this repository.

The model uses illustrative physical parameters, constrained paper geometry and composited ink; it is not a measured historical replica or a deformable-material solver. Keyboard pressure is supplied through the touch setting. Storage conflict protection is optimistic rather than atomic for simultaneous writers; the README instructs using one writing tab. The Three.js bundle has a non-fatal size advisory (about 149 kB gzip). Claude review was unavailable due to an expired login; an independent pinned Codex reviewer completed both rounds. No deployment was requested or performed.
