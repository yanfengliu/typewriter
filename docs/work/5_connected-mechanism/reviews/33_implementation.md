# Independent scalar printing-episode investigation

## Target

Read-only investigation of the unaccepted local pressure-coupling diagnostic at base b0e5175fa08f93a09e3cdd1f5df43b5e3c5f864c. Frozen input manifest3911B14C9D50F98C2EA8F2A2D1FEC5F7E42268559C9B1C75D2E11017694FB2F6 covers62 files. Exact reviewed inputs remain under primary output/printing-episode-review/input. Coordinator target-recovery.patch SHA-256 5e7649d69546adc022efe966f872bb22d6f4f7809d52ea4076dc9085cec73cb5 covers those tracked/untracked/ignored inputs and passes an apply check against the base index. No canonical implementation is proposed for acceptance.

## Reviewers and coverage

Independent printing_episode_review, gpt-6-astra xhigh, inspected frozen source and ran three bounded independent diagnostics in an isolated detached worktree. This is an agent investigation, not a dual-CLI review. It did not run full-bank dynamics, geometry repairs, browser checks or the121-test main suite.

## Reports

The substantive authored report follows verbatim as a blockquote. Primary output/printing-episode-review/report.md SHA-256 8a45b721f128bb7ac3b8659ce5c0ac1601d6d648e00e4725b0040cf23672bdb8; artifact manifest SHA-25685EA0DE2930F2D1B481E08B8DC36463B897201482EDB662E28DAA65EAC0CEECC.

> # Independent printing-episode numerical/mechanical review
>
> Reviewed on 2026-11-08. This is an investigation of a local pressure-coupling prototype, not physical acceptance, a canonical implementation proposal, or reopening of the accepted FCR solver repair allowance. No source, geometry, solver, material constant, or tolerance was changed. No browser, server, or full-bank trajectory was run. No additional reviewer or CLI lane was launched.
>
> ## Exact target and recoverable evidence
>
> Base revision: `b0e5175fa08f93a09e3cdd1f5df43b5e3c5f864c`. Input manifest SHA-256: `3911b14c9d50f98c2ea8f2a2d1fec5f7e42268559c9b1c75d2e11017694fb2f6`. All 62 listed files were hash-verified before copying into an isolated detached worktree and verified again before retention. The recoverable frozen bytes are retained under `input/`; `input/manifest.json` is the exact supplied manifest. Findings below refer to those frozen bytes, not later geometry candidates. An artifact hash manifest is supplied beside this report.
>
> Key target hashes: original diagnostic TypeScript `3b221be129f9e9c151f60bc560517b7d3b0c125c45d343ddc9f97b28d33f307d`; original result JSON `aecad28907441bcf90384e2ccd807ae5a5e31dff009253c4e59e742b7c881006`; fixed-first-sample TypeScript `ecbe2b6f34b0904ca7ce89a4812af27c692c2e59f2dc117973cb9a11a4d1fd5d`; material source `3ad1d7f080406d400edd45853db5a326575a2ea6d4ee82fa32f9519a2c2214dc`; unilateral source `74f59482068263045514ee5daadf019ab98be32d0c32d355c8e446a064ea5e28`; definition source `7ee8962c74c2dcd4bd6d5f00fdb0b406a04aab12daaa889d538b9c377ede1659`.
>
> **Proves:** target identity and recovery, with review experiments isolated from the author's tree. **Does not prove:** a clean main implementation, public activation, or physical validity of this target. `docs/learning/lessons.md` was absent from both the primary and base review tree; it could not be read.
>
> ## PE-1 — Unresolved face-feature changes explain the dominant residual location
>
> The diagnostic computes `gap=min(gaps)` and takes the derivative of the winning sample (`input/output/prototype/printing-episode-diagnostic.ts:32-34`), then supplies that derivative directly to elastic and dissipative generalized forces (`:48-50`). It calls ordinary `system.step(dt)` without a feature guard (`:57`). The solver expressly requires smooth formulas through each step and asks callers to stop at force/topology discontinuities (`input/src/mechanism/unilateral.ts:9-13`); its smooth step uses four Runge–Kutta stage evaluations (`:348-356`). A minimum of nine smooth gaps is generally continuous but not differentiable at a change of minimizing feature. This caller violates that smooth-force assumption when the active sample changes.
>
> The instrumented same-model run reproduces every original result field for all 12 episodes exactly, including the residuals. Its only numerical additions are observation records. In the finest original lower-case `a` episode, the step containing the approach feature change and ring impact contributes `+4.6819903368812725e-7 J`; residual before that step is `-2.9839617436580416e-9 J`. The return feature crossing contributes a further `+2.0900980099436417e-8 J`. Final residual is the original `+4.861229441210924e-7 J`. The other three configurations also place their largest residual increment in the approach-switch/impact step. See `evidence/review-summary.json` and full `evidence/review-same-model-trace.json`; observer code is `evidence/review-same-model-trace.ts:57-60`.
>
> The physical gap derivatives on opposite sides of the first approach switch differ substantially: for lower-case `a`, about `-5.168595` versus `-5.701558 m/rad`, with total potential gradient about `28.765516` versus `31.703165 J/rad`. The switch-to-ring coordinate distance is `3.5121794063341927e-7 rad`; dividing by the incoming ring velocity gives an approximate `0.618856 us`. All four corresponding time estimates are `0.612123–0.630062 us`, below the original finest `2.5 us` step. These are coordinate-distance/velocity estimates, not localized trajectory timestamps. The derivative probe samples `q_switch +/- 1e-10 rad`; its two potentials therefore differ by legitimate work over that tiny interval, not an observed energy jump at equal q. See `evidence/review-derivatives.ts:46-59` and its JSON.
>
> The ring impulse itself is not the demonstrated energy defect: independently evaluating `0.5*M*(v_after^2-v_before^2)+event.loss` for each coarse run's ring event gives magnitude at most `1.3877787807814457e-17 J`. This agrees with the fixed-boundary impulse account (`input/src/mechanism/unilateral.ts:395-405`). It does not independently validate the integrated incoming state.
>
> **Proves:** the smooth-step contract is violated at actual feature changes; dominant observed residual increments coincide with those changes, and the algebraic impulse ledger closes at rounding scale. **Does not prove:** a fully isolated causal decomposition of every residual, or that feature-boundary handling alone will meet an acceptance criterion. Entry at zero indentation, ordinary integration error, finite-precision geometry, and return-feature integration remain contributors. No repaired trajectory was run.
>
> ## PE-2 — The fixed-first-sample variant changes the physical scalar gap
>
> The variant freezes `winner=initialWinner` (`input/output/prototype/printing-episode-smooth-feature.ts:27-37`), while checking its agreement with the true nine-point minimum at recorded states (`:45,57`). That check correctly rejects the lower-case `a` ring state. The independent frozen-geometry probe confirms the same `1.8723546400811752e-7 m` discrepancy: true indentation is approximately `80 um`, while the first sample gives `79.812764536 um`. The accepted material formula therefore stores `1.831786887170445e-4 J` under the minimum but only `1.821087710085643e-4 J` under the fixed sample, a `1.0699177084801982e-6 J` deficit. All four configurations show essentially the same deficit at the ring.
>
> This difference is not just a selector label changing among identical points. At the ring, the middle-height samples are genuinely deeper than the top/bottom samples, while several samples along width are equal to rounding precision. The manufactured face radius includes the uncompressed stack (`input/src/mechanism/definition.ts:136`); `facePoint` retains that radius (`input/src/mechanism/contacts.ts:29-34`). Compression does not refit the metal curve. This is a real difference within the declared envelope geometry, independent of whether that envelope is an adequate material model.
>
> **Proves:** the fixed-first-sample workaround does not integrate the original min-gap law and its retained-state agreement check rightly fails. **Does not prove:** a physical defect in the manufactured geometry, a need to change its curvature, or permission to loosen the check. Its apparent smoothness cannot be used as acceptance of the original model.
>
> ## PE-3 — The scalar material projection is internally consistent away from switches
>
> Let `delta=max(0,-g(q))`, `deltaDot=-g'(q)*v`, elastic force `Fe`, total normal force `F`, and signed dissipative force `D=F-Fe`. The supplied energy is `U=k*delta^(n+1)/(n+1)` and `dU/dq=-Fe*g'`. The diagnostic's conservative and dissipative terms therefore sum to normal generalized force `F*g'`, with dissipative power `D*g'*v=-D*deltaDot=-lossRate`. This matches `input/src/mechanism/print-material.ts:32-48`, the diagnostic's `:41,48-50`, and the solver's force/power convention at `input/src/mechanism/unilateral.ts:298-310`. No sign, missing area factor, or double-counted elastic force was found. Apparent area converts the declared whole-contact normal force into pressure; it does not belong as an extra multiplier in this existing lumped force projection.
>
> Mass is `sum(I_i*theta_i'^2)` and its derivative is `sum(2*I_i*theta_i'*theta_i'')`, appropriate to the declared four grounded-hinge lumped rotors. Hinge inertias already include COM offsets (`input/src/mechanism/definition.ts:19-25`; `input/src/mechanism/kinematics.ts:43-55`), so adding another COM translational term would double count them. The fixed basket displacement in these individual episodes does not add a moving-basket kinetic term. Gravity uses the same solved bodies as its analytic gradient; ring expressions use the relative-to-bar-hinge definition (`input/src/mechanism/definition.ts:36-37,137`; diagnostic `:35-40`; `input/src/mechanism/link-derivatives.ts:9-35`).
>
> Central differences at six interior coordinates per configuration, on both active-feature regions, show no persistent derivative mismatch. At `h=1e-9 rad`, maximum scaled differences `abs(fd-analytic)/max(1,abs(analytic))` are `2.2813e-7` for mass derivative, `3.6594e-8` for base potential gradient, `2.1086e-7` for total potential gradient, `2.2025e-7` for face-gap derivative, and `1.6634e-7` for ring-gap derivative. The retained table also includes `h=1e-8` and `1e-10`; smaller spacing shows subtraction/geometry rounding limits. These are diagnostic differences, not rigorous error bounds. Second derivatives were read and reasoned about but not independently finite-differenced in this probe.
>
> **Proves:** the declared scalar energy and force projection are algebraically compatible away from feature changes, with bounded spot checks supporting the supplied first derivatives. **Does not prove:** physical calibration of material stiffness, damping, apparent area, masses, springs, or the pre-contact incoming state. Those remain explicit estimates/reconstruction inputs (`input/src/mechanism/print-material.ts:1-15`; `input/src/mechanism/definition.ts:4-6,21-22,46-49,138-140`). The new account starts at first touch (`diagnostic:51`; unilateral `:234`), so it does not certify energy continuity against the prior finite-finger integrator's entire history.
>
> ## PE-4 — Additional refinement reduces the scale but remains nonmonotonic
>
> Only lower-case `a` was refined further, with the identical source model, incoming state, geometry, material constants, and solver options except `maxStep`. The loop bound was raised solely to let the smaller steps reach separation, and all five runs did separate. No tolerance or solver changes were used.
>
> | Step (us) | Final residual (J) | Anchor centroid distance (um) | Pressure-time (Pa s) |
> | --- | --- | --- | --- |
> | 2.5 | +4.861229441e-7 | 24.7321000 | 384.1150183 |
> | 1.25 | -3.044418913e-8 | 24.7273367 | 384.0529307 |
> | 0.625 | -7.122661069e-8 | 24.7247793 | 384.0581415 |
> | 0.3125 | -1.579340871e-7 | 24.7232718 | 384.0753592 |
> | 0.15625 | -2.900210002e-8 | 24.7226531 | 384.0846582 |
>
> The step phase relative to the narrow feature interval remains consequential. These values do not establish a convergence order or a monotone error bound. The original three-step residuals and all new residuals remain retained and unaccepted.
>
> **Proves:** the residual is sensitive to time resolution within the same model; smaller steps can reduce its magnitude without changing constants, but the tested sequence is still nonmonotonic. **Does not prove:** numerical acceptance at any listed step or generality beyond this one refined configuration.
>
> ## PE-5 — The centroid is an anchor-motion observable, not a spatial print centroid
>
> The diagnostic assigns the whole scalar pressure to `sheetCoordinates(a.face,...)` with fixed carriage and feed (`input/output/prototype/printing-episode-diagnostic.ts:53-54`). That function maps the face center, not the active contact point or a resolved pressure field (`input/src/mechanism/contacts.ts:79-87`). The exposure implementation explicitly calls its spread anchor-motion spread without adding the glyph footprint (`input/src/mechanism/print-material.ts:118-132`). The stored original 23–29 um distances therefore report a pressure-weighted face-center path under the lumped uniform-area hypothesis. The ring/face fitting already places the held face center at the print datum (`input/src/mechanism/definition.ts:69-76,90-137`), so proximity to that datum is not independent source validation.
>
> Recording both velocity sides at identical ring coordinates is correct for this diagnostic: the velocity-dependent pressure jumps at the impulse, and same-time left/right limits add no exposure while choosing the outgoing interval's pressure (`diagnostic:58`; material `:130-131,157-177`). The final supplied endpoint is beyond separation, with pressure zero, but separation itself is not localized as an exposure event; linear interpolation spans the last sampling interval. The exposure class declares no bound for unsampled histories (`material:81-85,124-132`).
>
> **Proves:** pressure comes from the stated material normal force rather than ring impact loss, and the sampled anchor observable is reproducible with proper same-time impact limits. **Does not prove:** physical ink centroid, spatial contact pressure, nine-point geometric convergence, actual glyph area, density/ink transfer, common-linkage operation, moving carriage/platen coupling, or full-bank clearance.
>
> ## Smallest principled next direction
>
> First keep the current nine-point scalar hypothesis and explicitly resolve its active-feature boundaries using the existing boundary protocol. The experiment must preserve the actual minimum gap, continuity of potential at a tie, original constants, and the unmodified residual ledger. Select the outgoing feature using motion/acceleration direction; handle reversal through the same boundary and duplicate/equivalent width features without zero-time selector chatter. The switch is before the ring, so ring localization alone is insufficient. Check elastic energy gradients and nonpositive dissipative power on each smooth side, record same-time observable limits when required, and compare localized boundary residual increments under refinement. This is a proposed diagnostic design, not an implemented or accepted repair. It does not authorize changes to the accepted solver.
>
> A distributed apparent-contact quadrature is a separate material hypothesis if spatial pressure is the objective. It would need a declared local energy density and fixed area weights whose projected force and loss derive from the same local indentations, plus spatial and time refinement. Copying the whole-contact `8e6` stiffness into every quadrature point would multiply the existing contact force; reinterpreting that coefficient requires an explicit constitutive declaration. There is no evidence here supporting constant tuning, changed geometry, a new tolerance, or replacing the gap with its first feature.
>
> **Proves:** there is a bounded next test that addresses the observed violated smoothness contract without hiding existing residuals. **Does not prove:** that this proposal will succeed, that distributed contact is required for the present scalar test, or that either hypothesis is physically accepted.
>
> ## Verification and resources
>
> The three numerical probes report 384.5657 ms, 242.7838 ms, and 580.2417 ms wall time, totaling 1207.5912 ms of instrumented numerical execution. Every probe was below the 2-second local bound and the assigned 5-second per-probe/20-second overall compute limits. No numerical run was started after the coordinator announced the geometry CPU gate. The original 121-test suite was not repeated, as directed. No code gates were claimed, because no implementation was proposed. Raw evidence and scripts are retained in ignored output; the frozen target is recoverable. All 74 retained artifact hashes passed verification before the isolated detached worktree was removed. No dependency junction or task-owned GUI/server was created. An elevated process inventory found no remaining task-owned Node/browser/GUI process.
>
> **Overall disposition:** retain this prototype and all residuals as unaccepted evidence. The strongest supported explanation is unresolved piecewise-smooth face-envelope forces, with correct scalar projection away from switches and a correctly closing ring impulse ledger. Physical acceptance and public activation remain out of scope and unproved.

## Findings and disposition

Accept PE-1 through PE-5 as bounded diagnostic findings. The scalar caller violates the smooth-force contract at changing face-envelope features; first-feature freezing changes the actual gap and stored energy. Retain the original residuals and rejected continuation. The consistent force projection and ring impulse balance do not validate the incoming full-machine state or spatial ink placement. Explicit feature-boundary handling is a proposed next diagnostic; no accepted solver, material constant, geometry or tolerance is changed by this disposition.

## Verification

Reviewer reproduced all12 original episodes exactly and used1.208 seconds of numerical probes, with no compute overlap after the geometry gate began. Additional timestep refinement remains nonmonotonic and unaccepted. Root inspected the authored report, matched its hash and checked recovery of the reviewed target. The reviewer retained74 hash-verified artifacts and removed its worktree; no task junction, browser, server or process remains.

## Round outcome

Proves reproducibility, a localized violation of the smooth-step contract and internally consistent scalar force/energy projection away from feature changes. Does not prove physical pressure distribution, an ink centroid, accepted numerical convergence, a complete mechanism or a repair. The full integration gate remains298/303 and public physical activation remains prohibited by its unmet acceptance criteria.
