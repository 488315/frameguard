# FrameGuard

FrameGuard is a local, human-in-the-loop visual change-review workspace built with React, TypeScript, Vite, and WebMCP. It starts empty: an agent can explicitly propose an adaptation or the user can import a validated FrameGuard layout, but protected elements and committed canvas state remain under explicit human control.

Live demo: https://488315.github.io/frameguard/

## Local development

```sh
npm install
npm run dev
```

Run `npm test` for the test suite and `npm run build` for a production build.

## Enable WebMCP in Chrome

1. Use Chrome 149 or newer.
2. Open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch Chrome.
3. Start FrameGuard with `npm run dev -- --host 127.0.0.1`.
4. Open the printed local URL in the WebMCP-enabled Chrome profile.

The interface remains fully usable when WebMCP is unavailable and reports that state in the review drawer. It never claims registration succeeded unless Chrome accepts the tool registrations.

## Judge demo

Try this prompt from a WebMCP-capable agent while FrameGuard is visible:

> Inspect the FrameGuard document, propose a mobile adaptation, approve the headline reflow and image crop, then stop and wait for my approval before applying anything.

The explicit proposal request provisions the demo workspace and appears immediately in the same interface. The attempted logo move remains visible and blocked. After the human confirms, ask the agent to apply approved changes, then undo them and export a review receipt. Rejecting that provisional proposal returns to the empty workspace.

## Tool surface

- `inspect_document`
- `propose_adaptation`
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
```

FrameGuard runs entirely in the browser. It does not transmit review data or require an application server.
