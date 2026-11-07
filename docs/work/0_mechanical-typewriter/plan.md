# Interactive mechanical typewriter

Status: active
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

- [ ] Physical keys and clickable 3D keys create ink at impact; the fixed printing point and moving carriage agree.
- [ ] Backspace preserves ink, overstrikes accumulate, margins do not wrap, return feeds paper, and shift selects uppercase.
- [ ] Inertia, spring return, collisions/jams, and pressure-dependent impressions are modeled and tested.
- [ ] Desktop and mobile layouts, alternate views, source notes, paper archive and PNG export work through real browser controls.
- [ ] Build, mechanics tests, independent review, secret scan, and available CI pass; task-owned processes and temporary files are cleaned up.

## Implementation steps

- Mechanics owner: mechanics agent; src/mechanics.ts and behavioral tests.
- Scene owner: studio_scene agent; src/scene.ts and 3D interaction.
- Writing room owner: writing_room agent; UI, paper and audio modules.
- Integration owner: root; shared contracts, research, dependencies, acceptance, review, documentation and Git delivery.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
