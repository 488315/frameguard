import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store";

test("renders the empty workspace with no demo layers or canvases", () => {
  render(<App />);
  expect(screen.getByRole("main")).toHaveTextContent("FrameGuard");
  expect(screen.getByText("Start your first review")).toBeVisible();
  expect(screen.getByText("No layers yet")).toBeVisible();
  expect(screen.getByText("No active proposal.")).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: "Create proposal" }),
  ).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Import layout" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reject all" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Apply 0 changes" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Allow agent apply once" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(screen.queryByLabelText("desktop canvas")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("mobile canvas")).not.toBeInTheDocument();
  expect(screen.getByText(/WebMCP unavailable/)).toBeVisible();
  expect(screen.queryByText("Logo")).not.toBeInTheDocument();
  expect(screen.getByText("No review loaded")).toBeVisible();
});

test("selects layers and focuses the related proposal change", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await user.click(
    screen.getByRole("button", { name: "Image, proposal affected" }),
  );
  expect(
    screen.getByRole("button", { name: "Inspect Image crop" }),
  ).toHaveAttribute("aria-current", "true");
  expect(screen.getAllByLabelText("proposed crop boundary")).toHaveLength(1);
});

test("rejects one proposed change without changing the committed revision", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await user.click(
    screen.getByRole("button", { name: "Reject Headline reflow" }),
  );
  expect(screen.getByText("Rejected", { selector: "span" })).toBeVisible();
  expect(screen.getByText("REVISION 01")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Apply 0 changes" }),
  ).toBeDisabled();
});

test("exposes rejection as a one-way decision with approval as its reversal", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  const reject = screen.getByRole("button", {
    name: "Reject Headline reflow",
  });
  expect(reject).not.toHaveAttribute("aria-pressed");
  await user.click(reject);
  expect(reject).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Approve Headline reflow" }),
  );
  expect(reject).toBeEnabled();
});

test("visibly reflects proposal, approval, apply, and undo", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  expect(
    screen.getByRole("button", { name: "Inspect Logo move" }),
  ).toBeVisible();
  expect(screen.getByText("Blocked", { selector: "span" })).toBeVisible();
  expect(screen.getByLabelText("headline boundaries")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Approve Headline reflow" }),
  );
  await user.click(screen.getByRole("button", { name: "Approve Image crop" }));
  await user.click(screen.getByRole("button", { name: "Apply 2 changes" }));
  expect(screen.getByText("REVISION 02")).toBeVisible();
  expect(screen.getByText("No active proposal.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Apply 0 changes" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("reject removes the proposal and preserves committed revision", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await user.click(screen.getByRole("button", { name: "Reject all" }));
  expect(screen.getByText("No active proposal.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reject all" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Apply 0 changes" }),
  ).toBeDisabled();
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("supports keyboard layer selection", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  const imageLayer = screen.getByRole("button", {
    name: "Image, proposal affected",
  });
  imageLayer.focus();
  await user.keyboard("{Enter}");
  expect(imageLayer).toHaveAttribute("aria-current", "true");
});

test("announces pending work and preserves state on failure", async () => {
  const store = createAppStore();
  store.propose = () => {
    throw new Error("Proposal service unavailable");
  };
  render(<App store={store} />);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(await screen.findByText("Proposal service unavailable")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false"),
  );
  expect(screen.getByText("REVISION 01")).toBeVisible();
  expect(
    screen.getByText("The committed document was not changed."),
  ).toBeVisible();
  store.record("inspect_document", "Document inspected after recovery");
  await waitFor(() =>
    expect(screen.getByText("inspect_document")).toBeVisible(),
  );
  expect(screen.getByText("Document inspected after recovery")).toBeVisible();
});

test("shows activity recorded after a completed UI action", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await waitFor(() =>
    expect(screen.getByText("propose_adaptation")).toBeVisible(),
  );
  store.record("inspect_document", "Document inspected");
  await waitFor(() =>
    expect(screen.getByText("inspect_document")).toBeVisible(),
  );
  expect(screen.getByText("Document inspected")).toBeVisible();
});

test("marks only the layer changed by the committed proposal", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await user.click(
    screen.getByRole("button", { name: "Approve Headline reflow" }),
  );
  await user.click(screen.getByRole("button", { name: "Apply 1 change" }));
  const modifiedHeadline = screen.getByRole("button", {
    name: "Headline, modified",
  });
  expect(modifiedHeadline).toBeVisible();
  expect(modifiedHeadline.querySelector("i")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Image" })).toBeVisible();
});
