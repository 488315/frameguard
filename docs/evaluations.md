# WebMCP evaluation cases

| Judge prompt                                                               | Expected tools              | Expected visible result                                                                                      |
| -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Inspect the workspace before changing it.                                  | `inspect_document`          | Empty startup returns `workspaceLoaded: false`; no demo content is injected.                                 |
| Create a structured mobile proposal with headline, crop, and logo changes. | `create_proposal`           | Rows use generated IDs; allowed changes preview and the protected Logo attempt is blocked.                   |
| Adapt this launch page for mobile.                                         | `propose_adaptation`        | Compatibility flow creates the same typed three-change proposal through the shared authority.                |
| Approve the headline and image changes, but do not apply yet.              | `set_change_approval` twice | Both allowed rows show selected; committed revision remains unchanged.                                       |
| Apply only what I approved.                                                | `apply_approved_changes`    | Revision advances atomically; proposal disappears; protected logo is unchanged.                              |
| Reject this proposal.                                                      | `reject_change_set`         | Proposal disappears without mutation; a provisional demo returns to the empty workspace.                     |
| Undo the last applied change set.                                          | `undo_last_change_set`      | Prior document is restored exactly and undo becomes unavailable.                                             |
| Export a receipt of the current review.                                    | `export_review_receipt`     | Activity reports a local receipt; returned JSON contains deterministic review state and no environment data. |
| Refresh after explicitly enabling recovery during an active review.        | browser reload              | A fully validated review returns with fresh IDs and replayed decisions; protected changes remain blocked.    |

Failure evaluations cover malformed input, invalid and protection-weakening imports, empty export, an empty objective, blocked change approval, zero selected changes, stale base revisions, duplicate apply, empty undo history, and malformed, oversized, stale, inconsistent, partial, or protection-tampered recovery data.

## Structured proposal example

```json
{
  "expectedRevision": 1,
  "title": "Mobile launch review",
  "objective": "Improve the narrow composition without changing protected branding.",
  "changes": [
    {
      "target": "headline",
      "operation": {
        "kind": "set_text",
        "canvas": "mobile",
        "value": "Make room for what comes next."
      },
      "rationale": "Use a deliberate mobile line break."
    },
    {
      "target": "image",
      "operation": {
        "kind": "set_image_position",
        "canvas": "mobile",
        "value": "72% center"
      },
      "rationale": "Keep the subject visible in the narrow crop."
    }
  ]
}
```

Unknown fields, unsupported target/operation combinations, duplicate operations,
invalid values, empty rationales, more than 20 changes, and stale revisions fail
closed. Protected targets remain inspectable as blocked proposal rows; they never
enter the applicable or apply counts.
