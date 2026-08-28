# Contributing to FrameGuard

Thanks for helping make visual-agent review safer and easier to understand. FrameGuard welcomes focused bug fixes, accessibility improvements, test coverage, documentation, and proposals that strengthen the human review workflow.

## Before you start

- Check the existing issues before opening a new one.
- For a user-visible behavior change, open an issue first so the interaction and safety boundary can be agreed on.
- Keep pull requests narrow. Avoid unrelated formatting, dependency, or architecture changes.
- Never include credentials, private review data, or generated browser profiles.

## Local setup

FrameGuard requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

The core interface works without WebMCP. To test agent tools, follow the Chrome setup in the [README](README.md#enable-webmcp-in-chrome).

## Product invariants

Contributions must preserve these boundaries:

- Agent calls and human controls go through the same state and validation authority.
- Drafting, previewing, and approving never mutate the committed document.
- Protected changes remain inspectable but cannot be approved or applied.
- Applying an approved change set is atomic; invalid or stale input cannot partially commit.
- The visible interface reflects background tool calls immediately.
- The default startup remains empty unless a change explicitly documents and tests a different product decision.

Read [docs/architecture.md](docs/architecture.md) before changing proposal state, WebMCP registration, protection rules, or receipt behavior.

## Tests and checks

Run the full local gate before requesting review:

```sh
npm run format
npm run lint
npm test
npm run build
npm run test:e2e
```

Add focused tests for changed behavior. Browser-visible work should cover both the rendered result and the underlying review state; safety changes should include rejection and no-partial-mutation cases.

## Pull requests

A useful pull request includes:

- the user problem and the chosen behavior;
- the affected ownership or lifecycle boundary;
- exact validation commands and results;
- screenshots for meaningful visual changes;
- explicit follow-up work or known limitations.

By contributing, you agree that your work is licensed under the repository's [MIT License](LICENSE).
