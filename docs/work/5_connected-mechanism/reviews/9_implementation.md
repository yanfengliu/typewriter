# Printing-stack source and contact-model follow-up

## Target

Bounded source/design review of the paper-calibrated segment abutment and local printing pressure. No complete implementation revision or calibrated material parameters are approved by this report.

## Reviewers and coverage

Independent mechanism_audit, gpt-6-astra, xhigh, inspected Royal1955 printed 48–50, figure 17 and paragraph 62d, plus Royal factory compilation printed 3–4. Root separately probed all 90 physical face endpoints under the proposed nominal cylinder shift.

## Reports

Retained output/ink-source-review/report.md, SHA256 4190D75037A8F8D904FC77820468E2C6F5D1C2B10BE8F7AE7DBD27D10BEB506D. source-manifest.json SHA256 0D347074914A5C46DFC840A339BF5561DD7F7CDF4B37EB868ADFB3C9418D02C3 records both source PDFs, exact page mappings, five verified page images and the coordinator's calibration probe.

## Findings and disposition

The adjustment explicitly uses one sheet or paper strips and equal face/cylinder versus bar/ring drag. It does not specify uncompressed ribbon thickness as part of the ring setting, nor explicitly command ribbon removal. First uncompressed-stack touch therefore must not silently become a duplicate rigid ring constraint with arbitrarily assigned paper impulse. Source adjustment establishes alignment, not dynamic load sharing.

Conditionally accept a reconstructed paper-present/ribbon-absent calibration: move the fitted cylinder forward by nominal ribbon thickness while retaining the manufactured action, print datum and abutment. Root's 90-pose probe preserves held q within 3.89e-16 radians; first ribbon contact leads by 12–51 microradians of key travel. Bare-cylinder trip must be refitted, and the metal face curvature must remain fixed independently of paper/ribbon presence. The nominal 80 micrometer stack allowance is an estimate, not measured clearance or permission to crush the ribbon to zero thickness.

Use an explicit non-tensile passive ribbon/paper/platen constitutive law. Keep stored elastic energy, dissipation and paper-side normal impulse separate. Transfer depends on local supported pressure/exposure at actual sheet material coordinates. Arbitrary rigid-LCP weights or total machine impact loss are not an adequate ink model. Material stiffness, damping, contact area, transfer law, pressure distribution and blur remain estimated/unverified.

## Verification

Source pages and retained copies were verified and hashed. The reviewer read but did not rerun the root probe. Source-geometry subsequently froze the paper-calibrated geometry and fixed curvature with 18 focused tests and TypeScript passing; root combined source/energy/curvature gate passes 27 tests. No fully coupled pressure integration, full typing matrix, browser or deployment was tested by this review. No browser/server processes were launched.

## Round outcome

Proves the source basis and a consistent nominal calibration construction; it resolves the ambiguity in duplicated rigid printing stops. Does not prove material calibration, realistic pressure histories, finite exposure footprints or completed ink transfer. Source-geometry owns shared geometry, linkage_geometry owns the bounded material/exposure functions, and root owns coupled integration, sensitivity and convergence checks.
