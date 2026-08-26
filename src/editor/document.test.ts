import { describe, expect, it } from "vitest";
import {
  createInitialDocument,
  auditDocument,
  parseImportedDocument,
} from "./document";

describe("editor document", () => {
  it("starts at revision one with protected logo and legal elements", () => {
    const document = createInitialDocument();
    expect(document.revision).toBe(1);
    expect(document.elements.logo.protected).toBe(true);
    expect(document.elements.legal.protected).toBe(true);
    expect(document.layouts.desktop.headline).toBe(
      document.layouts.mobile.headline,
    );
  });

  it("returns deterministic protection audit results", () => {
    expect(auditDocument(createInitialDocument())).toEqual([
      { id: "logo-protected", status: "pass", message: "Logo is protected" },
      {
        id: "legal-protected",
        status: "pass",
        message: "Legal line is protected",
      },
      {
        id: "layout-parity",
        status: "pass",
        message: "Both canvases share six elements",
      },
    ]);
  });

  it("parses a complete imported document without sharing input state", () => {
    const source = createInitialDocument();
    const imported = parseImportedDocument(JSON.stringify(source));
    expect(imported).toEqual(source);
    imported.layouts.mobile.headline = "changed";
    expect(source.layouts.mobile.headline).not.toBe("changed");
  });

  it("rejects malformed, partial, and unprotected imports", () => {
    expect(() => parseImportedDocument("not json")).toThrow("valid JSON");
    expect(() => parseImportedDocument('{"revision":1}')).toThrow(
      "complete FrameGuard document",
    );
    const unprotected = createInitialDocument();
    unprotected.elements.logo.protected = false;
    expect(() => parseImportedDocument(JSON.stringify(unprotected))).toThrow(
      "Logo and Legal must remain protected",
    );
  });
});
