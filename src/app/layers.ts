import type { EditorDocument, ElementId } from "../editor/document";
import type { Proposal, ProposalChangeId } from "../review/models";

export interface LayerNavigatorItem {
  id: ElementId;
  label: string;
  protected: boolean;
  selected: boolean;
  proposedChangeCount: number;
  hasProposedChanges: boolean;
}

interface LayerNavigatorSource {
  document: EditorDocument | null;
  proposal: Proposal | null;
  selectedLayer: ElementId | null;
}

export function deriveLayerNavigatorItems(
  source: LayerNavigatorSource,
): LayerNavigatorItem[] {
  if (!source.document) return [];

  const unresolvedCounts = new Map<ElementId, number>();
  for (const change of source.proposal?.changes ?? []) {
    if (change.decision !== "pending") continue;
    unresolvedCounts.set(
      change.target,
      (unresolvedCounts.get(change.target) ?? 0) + 1,
    );
  }

  return Object.entries(source.document.elements).map(([rawId, element]) => {
    const id = rawId as ElementId;
    const proposedChangeCount = unresolvedCounts.get(id) ?? 0;
    return {
      id,
      label: element.label,
      protected: element.protected,
      selected: source.selectedLayer === id,
      proposedChangeCount,
      hasProposedChanges: proposedChangeCount > 0,
    };
  });
}

export function resolveRelatedChangeId(
  proposal: Proposal | null,
  layerId: ElementId,
): ProposalChangeId | null {
  const related = proposal?.changes.filter(
    (change) => change.target === layerId,
  );
  if (!related?.length) return null;
  return (
    related.find((change) => change.decision === "pending")?.id ?? related[0].id
  );
}
