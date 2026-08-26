import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store";

test("renders the application shell", () => {
  render(<App />);
  expect(screen.getByRole("main")).toHaveTextContent("FrameGuard");
  expect(screen.getByText("Nothing changes without approval.")).toBeVisible();
  expect(screen.getByText(/WebMCP unavailable/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Logo, protected" })).toBeVisible();
});

test("selects layers and focuses the related proposal change", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getByRole("button", { name: "Create demo proposal" }),
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
    screen.getByRole("button", { name: "Create demo proposal" }),
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

test("visibly reflects proposal, approval, apply, and undo", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await user.click(
    screen.getByRole("button", { name: "Create demo proposal" }),
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
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("reject removes the proposal and preserves committed revision", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getByRole("button", { name: "Create demo proposal" }),
  );
  await user.click(screen.getByRole("button", { name: "Reject all" }));
  expect(screen.getByText("No active proposal")).toBeVisible();
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("supports keyboard layer selection", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  const imageLayer = screen.getByRole("button", { name: "Image" });
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
  fireEvent.click(screen.getByRole("button", { name: "Create demo proposal" }));
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(await screen.findByText("Proposal service unavailable")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false"),
  );
  expect(screen.getByText("REVISION 01")).toBeVisible();
  expect(
    screen.getByText("The committed document was not changed."),
  ).toBeVisible();
});
