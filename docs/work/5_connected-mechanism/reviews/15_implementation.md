# Compensated contact-kernel repair review

## Target

Exact commit 0a16882873f9dd70f9372a1991e59d04591ac57c, parent f1fb1f911daf812c101fd5e474e4ae3136e0fae2. This is the owner's authorized numerical repair attempt 6, covering accepted position, velocity and time accumulation and contact-boundary chronology.

## Reviewers and coverage

Independent finite_review, gpt-6-astra, xhigh. This is an agent review, not a dual-CLI review. The reviewer used an isolated exact-revision worktree and retained the original failure probes unchanged.

## Reports

Primary checkout output/finite-contact-review/repair-0a1688/report.md, SHA256 784AD28428A73C15E2AEF3041B6C291F15A91C69568E41D000BF0271C92D9BB2. The report includes exact source blob hashes, independent probes and retained exploratory limitations.

## Findings and disposition

Accept the bounded repair and close FCR-1 and FCR-2. The positive-gap replacement probe preserves state and energy; all 336 original coincidence cases and 240 additional accelerated cases pass. The 34 focused tests pass. Independent checks cover speculative-trial carry isolation, coupled impulses, retained tangential motion, failed replacement rollback, contact identity/history and requested force horizons. No new actionable finding was found in this revision.

FCR-3 remains open and was reproduced unchanged: the finite contact adapter evaluates a degenerate frozen axis before it can localize its feature boundary. This review does not accept that adapter or the physical full cycle. The deliberately coarse curved-support exploratory probe still shows the parent's small recaptures and trajectory error; its narrower carry-isolation result must not be reported as drift-free integration.

## Verification

Proves the reviewed numerical event/history repair at this revision. Does not prove source-key load transmission, independent idle-key support, finite-axis domain handling, whole-machine dynamics or interactive performance. The author reports 190 full tests and build passing; the reviewer did not duplicate that full gate. Review worktree and task processes were cleaned; evidence remains in ignored output.

## Round outcome

Accept 0a1688 for FCR-1 and FCR-2 only. FCR-3 and whole-machine acceptance remain open.
