# FrameGuard

FrameGuard is a local, human-in-the-loop visual change-review workspace built with React, TypeScript, Vite, and WebMCP. It starts empty: an agent can explicitly propose an adaptation or the user can import a validated FrameGuard layout, but protected elements and committed canvas state remain under explicit human control.

Live demo: https://488315.github.io/frameguard/

## Local development

```sh
npm install
npm run dev
```

Run `npm test` for the unit/component suite, `npm run test:e2e` for the real
browser workflow, and `npm run build` for a production build.

## Enable WebMCP in Chrome

1. Use Chrome 149 or newer.
2. Open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch Chrome.
3. Start FrameGuard with `npm run dev -- --host 127.0.0.1`.
4. Open the printed local URL in the WebMCP-enabled Chrome profile.

The interface remains fully usable when WebMCP is unavailable and reports that state in the review drawer. It never claims registration succeeded unless Chrome accepts the tool registrations.

## Judge demo

Try this prompt from a WebMCP-capable agent while FrameGuard is visible:

> Inspect the FrameGuard document. Create a proposal titled “Mobile launch
> review” that changes the mobile headline to “Make room for what comes next.”,
> moves the mobile image position to “72% center”, and attempts to change the
> protected Logo. Explain each change, then stop and wait for my approval.

The explicit request calls the structured `create_proposal` tool and provisions
the starter workspace. Its generated change IDs become the enum values for the
review-only tools. The attempted logo change remains visible and blocked. Drafting,
previewing, and approving do not alter the committed document. After the human
confirms, ask the agent to apply approved changes, then undo them and export a
review receipt. Rejecting a provisional proposal returns to the empty workspace.

## Tool surface

- `inspect_document`
- `create_proposal` — exact, bounded structured proposal input
- `propose_adaptation` — compatibility shortcut routed through the same authority
- `set_change_approval` (active proposal only)
- `apply_approved_changes` (active proposal only)
- `reject_change_set` (active proposal only)
- `undo_last_change_set`
- `export_review_receipt`

See [docs/evaluations.md](docs/evaluations.md) for deterministic evaluation cases.
See [docs/architecture.md](docs/architecture.md) for ownership, invariants, and implementation boundaries.

## Quality gates

```sh
npm run format
npm run lint
npm test
npm run build
npm run test:e2e
```

FrameGuard runs entirely in the browser. It does not transmit review data or require an application server.
