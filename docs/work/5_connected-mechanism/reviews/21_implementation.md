# Retained idle-key flight calculation review

## Target

Frozen 56-file output-only calculation, manifest28BF4D652E5A573CCCCEFAB2CC5B675B43601C81E89846FEA625F5334D0AC309. It extends kernel0a1688 to51 coordinates, a large-contact active-set QP and safeguarded scalar root search. It does not include the laterfb15617 domain/deadline repairs.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. Agent review, not dual-CLI. Exact frozen inputs, independent scalar/contract/physics probes and one bounded two-microsecond trajectory.

## Reports

Primary output/finite-contact-review/retained-flight/report.md, SHA2567DDABEA2E604BEDD5CBC1D5B2EDE90B1634AE13B681A33330F99AF5A1B903380. Frozen files, probes, complete trajectory output, prior failed runtime attempts and the reviewer postprocessor failure are retained alongside it.

## Findings and disposition

Accept only the reconstructed-system calculation. All44 idle keys release and recapture with nonnegative impulses while all51 coordinates remain dynamic. No new blocking finding was identified in this scope. Known generic rank/conditioning failures remain explicit; no regularization or invented holding force is accepted. The fixture uses the superseded grounded common-lift parent and therefore proves no actual Royal cycle.

## Verification

All56 frozen files matched. Independent scalar tests cover340 brackets, including plateaus, subnormal intervals and adjacent floats, retaining the original2^-42 bracket resolution and actual integrated upper state. Actual51-coordinate release/recapture with ten duplicate normals agrees with independent arrowhead momentum equations to2.12e-21 in velocity; sparse/dense inertial and kinetic-power identities agree within5.42e-20/1.19e-20. The single trajectory completes in4.29seconds, with44 positive idle recaptures and energy residual2.17e-15J. Wrapped force-horizon, state/carry and passivity checks pass. The reviewer's later event-filter postprocessor counted zero-valued contact entries and failed; its output is preserved, and separate offline comparison correctly verifies positive impulses without rerunning dynamics. Author step-halving evidence has identical event order/times. The reviewer did not duplicate the broad387-case QP sweep or full repository gate.

## Round outcome

This proves the bounded numerical flight and original-bracket localization on the frozen reconstruction. It does not prove general solver acceptance, complete physical typing, source-correct common-lift dynamics, realtime performance, mobile operation or public integration. Porting these changes onto the repairedfb15617 kernel requires a separate exact review. Owned review processes and disposable worktree were cleaned.
