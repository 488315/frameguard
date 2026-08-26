# WebMCP evaluation cases

| Judge prompt | Expected tools | Expected visible result |
| --- | --- | --- |
| Inspect this document before changing it. | `inspect_document` | Activity strip reports inspection; revision remains unchanged. |
| Adapt this launch page for mobile. | `propose_adaptation` | Three review rows appear: two applicable and one protected logo move blocked. |
| Approve the headline and image changes, but do not apply yet. | `set_change_approval` twice | Both allowed rows show selected; committed revision remains unchanged. |
| Apply only what I approved. | `apply_approved_changes` | Revision advances atomically; proposal disappears; protected logo is unchanged. |
| Reject this proposal. | `reject_change_set` | Proposal disappears without changing the committed revision. |
| Undo the last applied change set. | `undo_last_change_set` | Prior document is restored exactly and undo becomes unavailable. |
| Export a receipt of the current review. | `export_review_receipt` | Activity reports a local receipt; returned JSON contains deterministic review state and no environment data. |

Failure evaluations cover malformed input, an empty objective, blocked change approval, zero selected changes, stale base revisions, duplicate apply, and empty undo history.
