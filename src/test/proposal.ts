import type { AppStore } from "../app/store";

export function createTestProposal(
  store: AppStore,
  objective = "Review mobile",
) {
  return store.createProposal({
    expectedRevision: store.getSnapshot().document?.revision ?? 1,
    title: "Mobile adaptation",
    objective,
    changes: [
      {
        target: "headline",
        operation: {
          kind: "set_text",
          canvas: "mobile",
          value: "Make room for\nwhat comes next.",
        },
        rationale: "Improve narrow-screen line balance.",
      },
      {
        target: "image",
        operation: {
          kind: "set_image_position",
          canvas: "mobile",
          value: "68% center",
        },
        rationale: "Keep the subject visible in the narrow crop.",
      },
      {
        target: "logo",
        operation: {
          kind: "set_text",
          canvas: "mobile",
          value: "Move logo into the image field",
        },
        rationale: "Test the protected brand boundary.",
      },
    ],
  });
}
