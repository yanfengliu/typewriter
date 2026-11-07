# Publish the typewriter on GitHub Pages

Status: active
Owner: Codex
Created: 2026-11-07
Updated: 2026-11-07

## Problem and outcome

Publish the existing typewriter at https://yanfengliu.github.io/typewriter/ with working assets and keyboard input.

## Scope

Add the Pages build and workflow, enable the repository's Pages configuration, deploy and verify the public site. No changes to the typewriter mechanism or paper format.

## Approach

Build on Node.js 24 with the committed dependency lock and existing tests. Use SHA-pinned official GitHub actions, read-only build permissions and a separate Pages deployment job. The Pages build uses /typewriter/ as its base path; local development retains its default path. Publish only dist. An independent reviewer checks the committed workflow before publication.

## Acceptance criteria

- [ ] All mechanical tests and the Pages build pass, with assets rooted at /typewriter/.
- [ ] Independent review accepts the committed workflow and deployment permissions.
- [ ] GitHub Actions deploys successfully; the live URL loads and retains a fast keyboard burst in a headless browser.
- [ ] Source and records are merged and pushed; task browser and worktree resources are cleaned.

## Implementation steps

- Root implements, tests and publishes; a read-only reviewer checks the exact source revision.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
