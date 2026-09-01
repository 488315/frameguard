# FrameGuard proposal workflow design QA

## Reference comparison

- Original reference: external `1672x941` design input retained only as historical provenance; the machine-local source path is not repository evidence.
- Matched capture: `artifacts/screenshots/empty-reference-1672x941-refined.png`.
- Side-by-side comparison: `artifacts/screenshots/empty-reference-comparison.png`.
- The matched capture uses the same viewport and empty state as the reference.

## Visual inspection

- P0: none.
- P1: none.
- P2: none after aligning the card top edge, card width, proposal icon position, and illustration proportions to the reference.
- The empty card remains centered in the workspace rather than the browser, controls do not shift between states, and no demo layers or canvases flash on startup.
- Responsive captures at `1920x1080`, `1440x900`, `1366x768`, `1280x720`, and `1024x768` show no horizontal overflow or collisions. At `1024x768`, the existing layout intentionally moves the review inspector below the workspace.
- Decorative empty-state graphics are hidden from assistive technology; keyboard actions and native disabled states remain intact.

## Proposal workflow captures

- States `01-empty.png` through `10-rejected.png` are under
  `artifacts/proposal-workflow/`.
- The inspected sequence covers empty, composer, populated draft, validation
  error, active proposal, selected preview, protected block, partial approval,
  applied, and rejected states.
- Responsive composer captures cover `1920x1080`, `1600x900`, `1440x900`,
  `1366x768`, and `1280x800`; no horizontal document overflow was detected.
- Draft and validation states keep the committed canvas unchanged. Active review
  rows show before/after values; the selected crop and protected Logo overlays
  remain restrained and legible. Applied state advances to revision 02; rejected
  state remains at revision 01.

## Interaction inspection

- Empty to proposal: passed.
- Proposal annotations and protected logo block: passed.
- Approve two changes, apply, and undo: passed.
- Reject provisional proposal back to empty: passed.
- Historical Playwright workflow at the time of this visual review: 4/4 passed. See the current validation section below for the maintained suite.
- Browser console warnings/errors: none observed in the automated product flow.

final result: passed

## Current automated validation

The maintained Playwright workflow currently contains nine non-visual browser
tests. Canonical visual baselines are compared separately on Ubuntu 24.04 with
Chromium through `npm run test:visual`; Windows runs must not update those
baselines. Record fresh command results in the change or pull request performing
the validation instead of treating this historical design review as current CI
evidence.
