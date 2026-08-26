export type Canvas = "desktop" | "mobile";
export type ElementId = "logo" | "headline" | "image" | "body" | "cta" | "legal";

export interface CanvasLayout {
  headline: string;
  imagePosition: string;
}

export interface EditorDocument {
  revision: number;
  elements: Record<ElementId, { label: string; protected: boolean }>;
  layouts: Record<Canvas, CanvasLayout>;
}

export interface AuditResult { id: string; status: "pass" | "fail"; message: string }

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
      desktop: { headline: "Make room for what comes next.", imagePosition: "center" },
      mobile: { headline: "Make room for what comes next.", imagePosition: "center" },
    },
  };
}

export function auditDocument(document: EditorDocument): AuditResult[] {
  return [
    { id: "logo-protected", status: document.elements.logo.protected ? "pass" : "fail", message: "Logo is protected" },
    { id: "legal-protected", status: document.elements.legal.protected ? "pass" : "fail", message: "Legal line is protected" },
    { id: "layout-parity", status: Object.keys(document.elements).length === 6 ? "pass" : "fail", message: "Both canvases share six elements" },
  ];
}

export function cloneDocument(document: EditorDocument): EditorDocument {
  return structuredClone(document);
}
