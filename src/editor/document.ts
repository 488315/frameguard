export type Canvas = "desktop" | "mobile";
export type ElementId =
  "logo" | "headline" | "image" | "body" | "cta" | "legal";

export interface CanvasLayout {
  headline: string;
  imagePosition: string;
}

export interface EditorDocument {
  revision: number;
  elements: Record<ElementId, { label: string; protected: boolean }>;
  layouts: Record<Canvas, CanvasLayout>;
}

export interface AuditResult {
  id: string;
  status: "pass" | "fail";
  message: string;
}

export function createInitialDocument(): EditorDocument {
  return {
    revision: 1,
    elements: {
      logo: { label: "Logo", protected: true },
      headline: { label: "Headline", protected: false },
      image: { label: "Image", protected: false },
      body: { label: "Body Copy", protected: false },
      cta: { label: "CTA", protected: false },
      legal: { label: "Legal", protected: true },
    },
    layouts: {
      desktop: {
        headline: "Make room for what comes next.",
        imagePosition: "center",
      },
      mobile: {
        headline: "Make room for what comes next.",
        imagePosition: "center",
      },
    },
  };
}

export function auditDocument(document: EditorDocument): AuditResult[] {
  return [
    {
      id: "logo-protected",
      status: document.elements.logo.protected ? "pass" : "fail",
      message: "Logo is protected",
    },
    {
      id: "legal-protected",
      status: document.elements.legal.protected ? "pass" : "fail",
      message: "Legal line is protected",
    },
    {
      id: "layout-parity",
      status: Object.keys(document.elements).length === 6 ? "pass" : "fail",
      message: "Both canvases share six elements",
    },
  ];
}

export function cloneDocument(document: EditorDocument): EditorDocument {
  return structuredClone(document);
}

const elementIds: ElementId[] = [
  "logo",
  "headline",
  "image",
  "body",
  "cta",
  "legal",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    [...keys].sort().every((key, index) => key === actual[index])
  );
}

export function parseImportedDocument(source: string): EditorDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Import must contain valid JSON");
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, ["revision", "elements", "layouts"]) ||
    !Number.isInteger(parsed.revision) ||
    (parsed.revision as number) < 1 ||
    !isRecord(parsed.elements) ||
    !hasExactKeys(parsed.elements, elementIds) ||
    !isRecord(parsed.layouts) ||
    !hasExactKeys(parsed.layouts, ["desktop", "mobile"])
  ) {
    throw new Error("Import must be a complete FrameGuard document");
  }
  for (const id of elementIds) {
    const element = parsed.elements[id];
    if (
      !isRecord(element) ||
      !hasExactKeys(element, ["label", "protected"]) ||
      typeof element.label !== "string" ||
      !element.label.trim() ||
      typeof element.protected !== "boolean"
    ) {
      throw new Error("Import must be a complete FrameGuard document");
    }
  }
  for (const canvas of ["desktop", "mobile"] as const) {
    const layout = parsed.layouts[canvas];
    if (
      !isRecord(layout) ||
      !hasExactKeys(layout, ["headline", "imagePosition"]) ||
      typeof layout.headline !== "string" ||
      typeof layout.imagePosition !== "string"
    ) {
      throw new Error("Import must be a complete FrameGuard document");
    }
  }
  const document = parsed as unknown as EditorDocument;
  if (!document.elements.logo.protected || !document.elements.legal.protected) {
    throw new Error("Logo and Legal must remain protected");
  }
  return cloneDocument(document);
}
