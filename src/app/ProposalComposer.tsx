import { useEffect, useMemo, useRef, useState } from "react";
import { LockKey, Plus, Trash } from "@phosphor-icons/react";
import {
  createInitialDocument,
  type Canvas,
  type ElementId,
} from "../editor/document";
import { operationMetadata, operationsForTarget } from "../review/operations";
import { ProposalValidationError, type ProposalInput } from "../review/review";
import type { AppSnapshot, AppStore } from "./store";

interface DraftChange {
  key: number;
  target: ElementId;
  kind: "set_text" | "set_image_position";
  canvas: Canvas;
  value: string;
  rationale: string;
}

const availableTargets: ElementId[] = ["headline", "image", "logo", "legal"];

function newDraftChange(key: number): DraftChange {
  return {
    key,
    target: "headline",
    kind: "set_text",
    canvas: "mobile",
    value: "",
    rationale: "",
  };
}

export function ProposalComposer({
  state,
  store,
  onCancel,
  onCreated,
}: {
  state: AppSnapshot;
  store: AppStore;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const source = useMemo(
    () => state.document ?? createInitialDocument(),
    [state.document],
  );
  const nextKey = useRef(2);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [changes, setChanges] = useState<DraftChange[]>([newDraftChange(1)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocus) return;
    fieldRefs.current[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [changes, pendingFocus]);

  const focusFirstError = (nextErrors: Record<string, string>) => {
    const firstPath = Object.keys(nextErrors)[0];
    requestAnimationFrame(() => fieldRefs.current[firstPath]?.focus());
  };

  const updateChange = (key: number, patch: Partial<DraftChange>) => {
    setChanges((current) =>
      current.map((change) =>
        change.key === key ? { ...change, ...patch } : change,
      ),
    );
  };

  const addChange = () => {
    const key = nextKey.current++;
    setChanges((current) => [...current, newDraftChange(key)]);
    setPendingFocus(`draft.${key}.target`);
  };

  const removeChange = (key: number) => {
    setChanges((current) => current.filter((change) => change.key !== key));
    setPendingFocus("addChange");
  };

  const currentValue = (change: DraftChange) => {
    if (change.kind === "set_text") {
      return change.target === "headline"
        ? source.layouts[change.canvas].headline
        : source.elements[change.target].label;
    }
    return source.layouts[change.canvas].imagePosition;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!title.trim()) localErrors.title = "Title is required";
    if (!objective.trim()) localErrors.objective = "Objective is required";
    if (changes.length === 0)
      localErrors.changes = "Add at least one proposed change";
    changes.forEach((change) => {
      if (!change.value.trim()) {
        localErrors[`changes.${change.key}.value`] =
          "Proposed value is required";
      }
      if (!change.rationale.trim()) {
        localErrors[`changes.${change.key}.rationale`] =
          "Rationale is required";
      }
    });
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setFormError(null);
      focusFirstError(localErrors);
      return;
    }
    const input: ProposalInput = {
      expectedRevision: state.document?.revision ?? 1,
      title,
      objective,
      changes: changes.map((change) => ({
        target: change.target,
        operation:
          change.kind === "set_text"
            ? {
                kind: "set_text",
                canvas: change.canvas,
                value: change.value,
              }
            : {
                kind: "set_image_position",
                canvas: change.canvas,
                value: change.value,
              },
        rationale: change.rationale,
      })),
    };
    try {
      store.createProposal(input);
      setErrors({});
      setFormError(null);
      onCreated();
    } catch (error) {
      if (error instanceof ProposalValidationError) {
        const nextErrors = Object.fromEntries(
          error.issues.map((issue) => [issue.path, issue.message]),
        );
        setErrors(nextErrors);
        focusFirstError(nextErrors);
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : "Proposal could not be created",
        );
      }
    }
  };

  const errorMessage = (path: string) => errors[path];
  const describedBy = (path: string) =>
    errorMessage(path) ? `${path.replaceAll(".", "-")}-error` : undefined;

  return (
    <form className="proposal-composer" onSubmit={submit} noValidate>
      <div className="composer-scroll">
        <label className="composer-field">
          <span>Title</span>
          <input
            ref={(node) => {
              fieldRefs.current.title = node;
            }}
            aria-label="Proposal title"
            aria-invalid={Boolean(errorMessage("title"))}
            aria-describedby={describedBy("title")}
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errorMessage("title") && (
            <small id="title-error" className="field-error">
              {errorMessage("title")}
            </small>
          )}
        </label>
        <label className="composer-field">
          <span>Objective</span>
          <textarea
            ref={(node) => {
              fieldRefs.current.objective = node;
            }}
            aria-label="Proposal objective"
            aria-invalid={Boolean(errorMessage("objective"))}
            aria-describedby={describedBy("objective")}
            maxLength={500}
            rows={3}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
          {errorMessage("objective") && (
            <small id="objective-error" className="field-error">
              {errorMessage("objective")}
            </small>
          )}
        </label>

        <div className="composer-section-head">
          <span>PROPOSED CHANGES</span>
          <b>{changes.length}/20</b>
        </div>
        {changes.map((change, index) => {
          const definitions = operationsForTarget(change.target);
          const definition =
            definitions.find((candidate) => candidate.kind === change.kind) ??
            definitions[0];
          const valuePath = `changes.${change.key}.value`;
          const rationalePath = `changes.${change.key}.rationale`;
          return (
            <fieldset className="draft-change" key={change.key}>
              <legend>Change {index + 1}</legend>
              {changes.length > 1 && (
                <button
                  type="button"
                  className="remove-change"
                  aria-label={`Remove change ${index + 1}`}
                  onClick={() => removeChange(change.key)}
                >
                  <Trash /> Remove
                </button>
              )}
              <label className="composer-field">
                <span>Layer</span>
                <select
                  ref={(node) => {
                    fieldRefs.current[`draft.${change.key}.target`] = node;
                  }}
                  aria-label={`Layer for change ${index + 1}`}
                  value={change.target}
                  onChange={(event) => {
                    const target = event.target.value as ElementId;
                    const nextOperation = operationsForTarget(target)[0];
                    updateChange(change.key, {
                      target,
                      kind: nextOperation.kind,
                      value: "",
                    });
                  }}
                >
                  {availableTargets.map((target) => (
                    <option key={target} value={target}>
                      {source.elements[target].label}
                    </option>
                  ))}
                </select>
              </label>
              {source.elements[change.target].protected && (
                <p className="protected-draft">
                  <LockKey weight="fill" /> Protected · this attempt will be
                  blocked by policy
                </p>
              )}
              <label className="composer-field">
                <span>Operation</span>
                <select
                  aria-label={`Operation for change ${index + 1}`}
                  value={change.kind}
                  onChange={(event) =>
                    updateChange(change.key, {
                      kind: event.target.value as DraftChange["kind"],
                      value: "",
                    })
                  }
                >
                  {definitions.map((operation) => (
                    <option key={operation.kind} value={operation.kind}>
                      {operation.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="composer-field">
                <span>Canvas</span>
                <select
                  aria-label={`Canvas for change ${index + 1}`}
                  value={change.canvas}
                  onChange={(event) =>
                    updateChange(change.key, {
                      canvas: event.target.value as Canvas,
                    })
                  }
                >
                  {(definition?.canvases ?? operationMetadata[0].canvases).map(
                    (canvas) => (
                      <option key={canvas} value={canvas}>
                        {canvas[0].toUpperCase() + canvas.slice(1)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="current-value">
                <span>Current</span>
                <p>{currentValue(change)}</p>
              </div>
              <label className="composer-field">
                <span>{definition?.valueLabel ?? "Proposed value"}</span>
                <textarea
                  ref={(node) => {
                    fieldRefs.current[valuePath] = node;
                  }}
                  aria-label={`Proposed value for change ${index + 1}`}
                  aria-invalid={Boolean(errorMessage(valuePath))}
                  aria-describedby={describedBy(valuePath)}
                  maxLength={1000}
                  rows={definition?.multiline ? 3 : 1}
                  value={change.value}
                  onChange={(event) =>
                    updateChange(change.key, { value: event.target.value })
                  }
                />
                {errorMessage(valuePath) && (
                  <small id={describedBy(valuePath)} className="field-error">
                    {errorMessage(valuePath)}
                  </small>
                )}
              </label>
              <label className="composer-field">
                <span>Rationale</span>
                <textarea
                  ref={(node) => {
                    fieldRefs.current[rationalePath] = node;
                  }}
                  aria-label={`Rationale for change ${index + 1}`}
                  aria-invalid={Boolean(errorMessage(rationalePath))}
                  aria-describedby={describedBy(rationalePath)}
                  maxLength={300}
                  rows={2}
                  value={change.rationale}
                  onChange={(event) =>
                    updateChange(change.key, { rationale: event.target.value })
                  }
                />
                {errorMessage(rationalePath) && (
                  <small
                    id={describedBy(rationalePath)}
                    className="field-error"
                  >
                    {errorMessage(rationalePath)}
                  </small>
                )}
              </label>
            </fieldset>
          );
        })}
        <button
          ref={(node) => {
            fieldRefs.current.addChange = node;
          }}
          type="button"
          className="add-change"
          disabled={changes.length >= 20}
          onClick={addChange}
        >
          <Plus /> Add change
        </button>
        {errors.changes && <p className="field-error">{errors.changes}</p>}
        {formError && (
          <p className="composer-error" role="alert">
            {formError}
          </p>
        )}
      </div>
      <div className="composer-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="apply" aria-label="Submit proposal">
          Create proposal
        </button>
      </div>
    </form>
  );
}
