# Atelier

A working 3D manual typewriter in a quiet, browser-based writing room. Type with your keyboard or click the machine's keys. Every impression is ink on paper: backspace moves the carriage and overtyping adds ink.

Fast typing is buffered: letters, spaces and carriage controls wait their turn while the mechanism animates, including in slow motion. Case, ribbon color and strike force are captured when you press each key. The status shows how many keystrokes are waiting. At a hard margin, overflow stays queued until you press Enter, backspace, or load a new sheet; there is no automatic wrap. Let the queue finish before closing the tab. The browser warns if you try to leave with unprinted input; queued keys themselves are not stored between page loads.

## Run

Requires Node.js 24 or later.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. `npm run build` checks TypeScript and creates a production build in `dist`; `npm run preview` serves it locally. `npm test` runs the deterministic mechanical behavior tests. The app needs WebGL 2 and uses no remote fonts, models, audio files, or runtime services.

## GitHub Pages

The public site is [Atelier on GitHub Pages](https://yanfengliu.github.io/typewriter/). The [publication workflow](.github/workflows/pages.yml) tests and builds the app on Node.js 24, then deploys `dist` when app or workflow changes reach `main`. Documentation-only commits skip publication; a manual run is also available in GitHub Actions.

`npm run build:pages` produces the same deployment build with asset URLs under `/typewriter/`. The regular development and build commands keep their default root path. Pages uses the GitHub Actions source in repository settings. No runtime server or credentials are included in the published bundle.

## Interactive mechanism tutorial

Choose **The mechanism** in the header for a seven-chapter 3D tour. Play, pause or scrub each demonstration; separate the assemblies, orbit the diagram, and return to writing at any time. The tour covers the whole assembly, key linkage, typebar impact, ribbon, full-drop escapement, basket shift, and carriage return with line feed. **Mechanics & sources** opens the supporting guide and primary references.

The tour pauses the live mechanism and keeps queued input. Its separate demonstration paper and explanatory poses never modify your saved sheets. Scrubbing can rewind this demonstration; written ink in the writing room remains permanent. Motion is slowed for explanation, and separated parts are an exploded diagram, not a physical disassembly simulation. Reduced-motion preferences disable automatic playback and camera transitions; the controls still work.

## Controls

| Input | Action |
| --- | --- |
| Letters, numbers, punctuation | Strike the corresponding typebar |
| Shift / Caps Lock | Select the upper character on the type slug |
| Space | Release the escapement one character without printing |
| Backspace | Move back one character; existing ink remains |
| Enter | Return the carriage and advance the platen |
| Tab (machine focused) | Travel to the next eight-column stop |
| Up / Down | Turn the platen backward / forward |
| Escape / Clear jam | Release collided typebars |
| Drag / scroll over the machine | Orbit / zoom the camera |

The margin bell warns near the end of the line. The right margin locks; there is no automatic word wrap. Click a 3D Shift key to arm the next clicked character; click Shift again to release it. New sheet retains the previous sheet in the local paper tray. Paper view and PNG export show all impressions, including overstrikes. Browser storage is local to the current origin; clearing it removes saved sheets, so export any pages you want to keep independently.

Use one writing tab at a time. A stale tab detects changes to the saved session and stops saving instead of overwriting newer sheets; its local pages remain available to export. This is optimistic conflict detection, not an atomic lock for exactly simultaneous writers.

## Mechanism and research

This is a composite manual front-strike design with basket shift. A key supplies energy to its linked typebar; a ribbon vibrator raises the fabric at the fixed printing point. Contact deposits ink. A full-drop escapement then releases a spring-driven carriage by one pitch. A platen ratchet indexes the paper for line feed. Backspacing reverses the carriage without changing the sheet.

Primary sources consulted:

- [U.S. Navy, Basic Machines (1965), chapter 12, PDF pages 103–116](https://files.eric.ed.gov/fulltext/ED173578.pdf): key action, mainspring and drawband, escapement dogs, ribbon drive, backspace, tabulator, and line-space ratchet.
- [Royal Typewriter Maintenance and Repair (1955), TM 10-602 / TO 25-5-34](https://site.xavier.edu/polt/typewriters/Royal1955.pdf): escapement and basket-shift assemblies, and the platen detent.
- [USPTO Class 400, subclass 329](https://www.uspto.gov/web/patents/classification/uspc400/defs400.htm): full-drop escapement sequence and permanent ribbon transfer.

## Physical model and limits

The mechanics run at a fixed time step with angular inertia, restoring springs, damping, gravitational torque, impact restitution, and constrained carriage stops. Printing depends on typebar contact. The underlying mechanism models typebar collisions, while the writing buffer sequences strokes safely so fast input does not cause jams or dropped letters. The paper follows a constrained path around a cylindrical platen; its texture retains fixed paper coordinates during feeding and carriage travel.

This is a reduced mechanical simulation, not a measured digital twin. Spring constants, masses, collisions and the synthetic sound are illustrative. Paper is not a finite-element model, and ink is textured compositing rather than a fluid solver. Normal keyboards have no pressure sensor: the touch setting supplies the modeled strike force. Slow motion scales simulation time to make the mechanism visible.
