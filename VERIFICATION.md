# Redesign verification — October 18, 2026

## Executed checks

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 8 tests passed: five engine/import tests and three playback tests for routing visibility, failure paths, and payload differences. The sandbox initially failed a Windows user-profile lookup; tests passed outside that restriction.
- `npm.cmd run build`: optimized production build passed, including every existing route.
- Taste source lint on `src/components/landing.tsx`: 0 failures, 0 warnings.
- Taste browser inspector at 1440, 768, and 390 pixels: 0 failures with the explicitly requested workflow-node card structure allowed. Five stylistic warnings are documented in DESIGN_REVIEW.md.
- No ESLint script or configuration exists; an ESLint check was not run.

## Browser evidence

The existing service at port 43819 served an older build. Current production validation used a fresh `next start` at 43820; final source changes and keyboard checks used the existing development server at 3000. These ports have independent browser storage.

Screenshot and machine-readable evidence lives under `.taste-skill/`:

- `final/`: landing screenshots at desktop/tablet/mobile widths and inspector report.
- `product-review/`: dashboard/editor screenshots at 1440, 768, and 390 pixels, reduced-motion screenshot, and functional results.
- `after/`: baseline screenshots of the previously served page, retained for comparison.
- `review.mjs`: repeatable isolated-browser workflow checks; accepts a base URL as its first argument.

## Working journeys verified

- Landing has six selectable nodes. Selecting the standard queue shows a skipped result for a high-value order. Changing the sample amount to 49 selects the standard branch and skips the CRM request.
- Use-case selection changes both content and the destination link; FAQ expands with native details controls.
- A starter workflow simulation completes successfully and persists in `flowforge:v1`. The dashboard shows one recorded execution and a recent run; execution history renders the same workflow.
- Dashboard and editor render with zero page-level horizontal overflow at 1440, 768, and 390 pixels. Workflow tables and the phone node palette use intentional internal scrolling.
- Reduced motion renders visible static content, a manual-preview label, and an Advance control. No hydration exceptions remain after switching to an SSR-consistent media-query subscription.
- Mobile navigation moves focus into its links, closes on Escape, and restores focus to the opener.
- No uncaught browser exceptions in the final journey.

## Review fixes

- Replaced unreadably small mobile type and compressed CTAs.
- Reflowed the demo graph into three columns on tablets and two columns on phones.
- Fixed document overflow caused by an absolutely positioned screen-reader table label by containing it in the scroll region.
- Replaced fit-to-entire-graph framing on small screens with a readable initial zoom, a pan hint, and an initially closed inspector.
- Added expanded-state/control relationships for the inspector and mobile navigation, keyboard tab selection, and a focusable workflow table region.

## Limits

### Dark-surface refinement

The production build (including TypeScript) passes after the surface-depth refinement. Browser review covered landing, dashboard, and paused editor playback at 1440, 768, and 390 pixels with zero page-level horizontal overflow and no uncaught exceptions. Computed styles confirmed brighter headings and active-port highlights. Solid text colors against the panel background measure 16.09:1 for body text, 7.97:1 for muted text, 5.76:1 for dim text, 17.15:1 for headings, and 12.95:1 for payload values; these are token-pair measurements rather than a complete accessibility audit. Screenshots and browser results are in `.taste-skill/surfaces/`.

### Ambient background follow-up

TypeScript and the production build pass after adding the background signal field. Browser canvas comparisons confirmed live motion, frozen frames while paused, resumed motion, and static frames with reduced motion. The mobile page has no horizontal overflow and the browser reported no uncaught exceptions. Desktop/mobile captures are in `.taste-skill/ambient/`; the repeatable check is `.taste-skill/ambient-review.mjs`.

### Automatic showcase and semantic colors follow-up

TypeScript, all five existing engine tests, source design lint for the new showcase, and the production build pass. The browser observed all three use cases and 11 changing phase messages during the automatic tour. Pause, manual selection, keyboard arrow navigation, and reduced-motion manual exploration passed. Dashboard, editor, and templates had zero page-level overflow at 1440, 768, and 390 pixels. Computed canvas styles confirmed five distinct node colors and differentiated source connectors at all three widths. No uncaught browser exceptions were recorded. Evidence and screenshots are in `.taste-skill/showcase/`; repeat with `.taste-skill/showcase-review.mjs`.

### Editor playback and node-preview follow-up

TypeScript, the production build, and all eight tests pass. An isolated browser verified configuration summaries on all six starter nodes; pause without partial history recording; single-step advance; input/output differences; one recorded execution on completion; cleared visuals and updated summaries after editing; failed-request and skipped-downstream states; and success/failure chart segments from two real simulated runs. Playback controls and output fit at 768 and 390 pixels, and reduced motion retains functionality without animated connectors. No uncaught browser exceptions were reported. Screenshots and results are in `.taste-skill/playback/`; repeat with `.taste-skill/playback-review.mjs`.

This review verifies the frontend simulation, not production integrations or service delivery. No backend, authentication, schema, secret, or deployment settings changed. No deployment or push was performed. The local directory has no Git repository, so a Git diff/status report is unavailable.
