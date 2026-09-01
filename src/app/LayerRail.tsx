import { LockKey } from "@phosphor-icons/react";
import React from "react";
import type { ElementId } from "../editor/document";
import { deriveLayerNavigatorItems, type LayerNavigatorItem } from "./layers";
import type { AppSnapshot, AppStore } from "./store";

export function LayerRail({
  state,
  store,
}: {
  state: AppSnapshot;
  store: AppStore;
}) {
  const layers = deriveLayerNavigatorItems(state);
  const listRef = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]',
    );
    selected?.scrollIntoView?.({ block: "nearest" });
  }, [state.selectedLayer]);
  const accessibleName = (layer: LayerNavigatorItem) => {
    const changeDescription = layer.hasProposedChanges
      ? `${layer.proposedChangeCount} proposed ${layer.proposedChangeCount === 1 ? "change" : "changes"}`
      : "no proposed changes";
    return [
      layer.label,
      layer.selected && "selected",
      layer.protected && "protected",
      changeDescription,
    ]
      .filter(Boolean)
      .join(", ");
  };
  const handleLayerKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    index: number,
    id: ElementId,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      store.selectLayer(id);
      return;
    }
    const movement = {
      ArrowDown: Math.min(index + 1, layers.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: layers.length - 1,
    }[event.key];
    if (movement === undefined) return;
    event.preventDefault();
    const options =
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    options?.[movement]?.focus();
  };
  return (
    <aside
      className={`layers${state.document ? "" : " layers-empty-state"}`}
      aria-label="Layers navigator"
    >
      <h1>Layers</h1>
      {!state.document ? (
        <div className="layers-empty">
          <b>No layers yet</b>
          <p>Import a layout or create a proposal to get started.</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="layer-list"
          role="listbox"
          aria-label="Document layers"
        >
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              role="option"
              aria-label={accessibleName(layer)}
              aria-selected={layer.selected}
              tabIndex={
                layer.selected || (!state.selectedLayer && index === 0) ? 0 : -1
              }
              className={`layer-row ${layer.selected ? "active" : ""} ${layer.hasProposedChanges ? "affected" : ""}`}
              onClick={() => store.selectLayer(layer.id)}
              onKeyDown={(event) => handleLayerKeyDown(event, index, layer.id)}
            >
              <span className="layer-no">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="layer-label" title={layer.label}>
                {layer.label}
              </span>
              <span className="layer-indicator" aria-hidden="true">
                {layer.hasProposedChanges && <i />}
              </span>
              <span className="layer-protection" aria-hidden="true">
                {layer.protected && <LockKey size={12} weight="fill" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
