# Independent source and coupled-mechanism rejection

## Target

Coordinator revision 8bfd1f042b63407fd4cfabb8de32141d7877f782 plus captured uncommitted source; candidate revision 1b2041321f3b0cb60e288c0598e813e3da34c8f0 plus frozen uncommitted source in .worktrees/auxiliary-timing. These are incomplete prototypes, not the deployed application. Root's preserved working patch SHA256 is 7CF3928F627E43ACC9F3F6E009F93D35D4E0B4FD2640DC2FF644EE3E17B6D760; candidate patch SHA256 is B3850C369F354C46A6F2669CAF020DAC1D68D6D032DC154D2B5115F18133A708. Later documentation edits are outside these source snapshots.

## Reviewers and coverage

Fresh independent mechanism_audit subagent, gpt-6-astra, xhigh. Read-only inspection of source, raw rendered Royal manual pages and frozen-copy probes. No repair candidate, assertion edits, browser or server was introduced. The reviewer inspected printed pages 20, 22, 23, 34 and 49 plus enlarged figure 7 of Royal1955.pdf (SHA256 26704307FCB209FD4CCA2F09343E153BEB39545D6F8FB6068E51DAF5CD9E5C4E).

## Reports

Retained report, runnable probe, results, source snapshots and byte manifest: output/mechanism-audit/{report.md,probe.ts,probe.jsonl,routing-recheck.json,snapshot-hashes.json,root-current,candidate}. The report identifies exact file lines and source paragraphs. Reproduce the frozen-copy check with `node --import tsx output/mechanism-audit/probe.ts` in the retaining worktree. Raw source and outputs remain deliberately retained ignored evidence.

### MA-1 — Early hard stop contradicts source adjustments (P1)

The auxiliary fit drives the rear-rocker and ribbon-cam stops before print. In the independent a/red fixture, the common stop is q=0.07095389997796313 and print is q=0.07204135356705532; the face center remains 4.436836 mm from the bare cylinder when the branch stops. At print the rocker sits exactly on its rear limit. Royal printed page 22, paragraph 31b(1)(b)/(2)(b), requires slight rear-limit clearance while the typehead is held against the cylinder. Printed page 34, paragraph 44b(3), places vibrator-arm/cam contact at paper impact and identifies early contact as choking the typebar. The worker's full-stop-before-ink gate is therefore an invalid source proxy.

### MA-2 — Return captures require an attractive unilateral impulse (P1)

JoinedAction chooses capture impulses from effective mass changes without testing contact direction or reaction sign. A returning driver captures followers that were stationary at their stops: qdot changes from -0.1768956264 to -0.1655723839, effective mass from 0.0752635016 to 0.0804106576. The newly moving branch acquires negative generalized momentum through receding push-only contacts. A finite return spring cannot supply that instantaneous velocity jump. The cycle nevertheless passes positive-loss checks and has residual 1.22e-12 J. Released followers need independent coordinates/velocities and admissible normal forces/impulses; scalar energy balance cannot substitute for these constraints.

### MA-3 — Candidate matrix differs from unchanged acceptance (P1 verification)

The worker's 360-case timing probe omits the coordinator assertion `columnAtImpact > 0 && columnAtImpact < 1`; nominal zero-backlash candidate impact position is exactly zero. The source establishes an axial washer gap, not strictly positive tangential travel. The reviewer supports an explicitly documented instrument correction allowing zero nominal preprint travel, preserving physical handoff, actual contact interval, one-tooth arrest and positive-gap sensitivity. This correction is approved as a source interpretation only; it has not been implemented, and no unchanged-gate pass is claimed. The coordinator also samples carriage state after the complete step instead of at ActionImpact.elapsed; event-time validation remains required.

### MA-4 — Work balancing hides a moving-contact velocity error (P2)

For an already loaded moving upper catch, carriage projection changes position but assigns zero velocity and books the energy difference as rocker work. In the supported 5-micrometer-gap fixture, position-derived inward speed tends toward 1.024135 micrometers/s as the rate rises to 15360 Hz while reported speed stays zero. The discrepancy persists with refinement although energy residual is about 1e-15 J. This small sensitivity-case error is not evidence of a large nominal ink error; it demonstrates the need to verify contact velocity and signed impulse alongside energy. The nominal zero-gap cycle has zero rocker work, so its port-work equality is vacuous.

## Findings and disposition

MA-1, MA-2 and MA-4 accepted and open. MA-3's unsupported positive-travel assumption is identified for a reviewed correction, but the existing failing gate and discrepancy are preserved. The candidate is rejected for activation. First correct source-derived contact/stop constraints and the released-follower dynamics; then freeze common geometry before any authorized routing repair. Do not replace contact checks with timers, targets or energy-bookkeeping adjustments.

The independent unchanged routing probe reproduces 18 overlap instances across six rod-23 pairs, worst 0.860916518 mm penetration. This rejects the best of five routing attempts. No further routing repair is authorized until the owner revises the AGENTS.md R11 limit; an explicit decision is pending. These failures do not establish that a valid construction is impossible.

## Verification

The reviewer independently checked 14,625 action poses: 45 keys, 65 stroke samples and five basket heights, with no invalid closure and maximum rod residual 2.08167e-17 m. Rest angles agree at the two detents within 2.35367e-14 rad; all 90 print centers agree within 1.82995e-15 m. These are numerical construction results, not historical dimensional measurements. Intermediate shifting is not claimed to keep zero bar angle. Finite axial dog withdrawal yields release angle 0.1917182942200264 rad; widths and tangential backlash remain fitted.

Reviewer independently reproduced the representative coupled cycle, contact-velocity refinement and unchanged routing rejection; inspected the saved 360 rows without rerunning the full matrix. Full application tests/build, the 111-million-pair solid audit, rendered whole-machine behavior, input/persistence and deployment were not independently rerun. Coordinator work-document schema and whitespace checks pass. Existing integrated failures remain open; no full clean gate is claimed.

## Round outcome

Do not accept or deploy the connected reconstruction. Proves bounded main-link closure, the corrected axial interpretation, and reproducible source/contact/routing defects that earlier passing metrics missed. Does not prove a physically valid assembled machine, unilateral return dynamics, stable ink placement, complete clearance, shared tutorial, mobile performance or release readiness. Previous ENERGY-01–05 closures apply to their reviewed numerical foundation, not to the new coupled model.
