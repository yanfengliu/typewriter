# Defect register

## 2026-11-07 — The tutorial named parts without teaching the mechanism

The owner reported that the exploded tour did not leave them able to teach someone else how a typewriter works. The opening animation only separated assemblies, while later chapters relied on broad 3D views and static paragraphs. Connections, contact and the distinction between finger energy and carriage-spring energy were not legible.

Replaced the default presentation with animated causal close-ups, a complete opening stroke, synchronized cause/effect captions, selectable moments and explanation questions. The 3D exploded view remains optional spatial context. Regression coverage in tests/tutorial.test.ts requires the opening's selected moments to demonstrate motion before ink, contact before carriage travel, exactly one space, and permanent ink after reset; all selectable moments must match their narrated interval. Headless visual acceptance additionally checks that the key linkage, ink-contact layers, escapement hold and return motions are readable on desktop and mobile. See docs/work/4_causal-tutorial/plan.md for the rendered verification and independent review.

## 2026-11-07 — Fast input was lost while the mechanism moved

The user reported missed letters during fast typing. Keyboard and pointer events went directly into the mechanical model, which rejected presses during carriage movement, paper feed, or a typebar's return; overlapping presses could jam before any text printed. A 5 ms interval burst reproduced the issue with zero printed letters and a jam.

Added a separate ordered input buffer that waits for a complete physical cycle, snapshots character modifiers and settings at input time, and retains controls in sequence. Hard-margin overflow stays pending until a manual control or fresh sheet makes space. A visible pending count and unload warning protect unprinted input. The original mechanical collision behavior remains covered independently.

Regression coverage: tests/buffered-typewriter.test.ts exercises zero-delay bursts, repeated and overlapping keys, spaces and controls, case/ribbon/force snapshots, typing during returns, margin recovery, new sheets, slow motion, and input release without cancellation. Browser verification exercises real keyboard events against the rendered app. See docs/work/1_buffered-typing/plan.md for delivery evidence.
