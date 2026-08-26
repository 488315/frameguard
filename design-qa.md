# FrameGuard empty workspace design QA

## Reference comparison

- Reference: `C:\Users\kjones\AppData\Local\Temp\codex-clipboard-383a7f61-1a32-4b76-84f8-bb29a30a59f7.png` (`1672x941`).
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

## Interaction inspection

- Empty to proposal: passed.
- Proposal annotations and protected logo block: passed.
- Approve two changes, apply, and undo: passed.
- Reject provisional proposal back to empty: passed.
- Browser console warnings/errors: none.

final result: passed
