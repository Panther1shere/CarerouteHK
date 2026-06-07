import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Save,
  X,
} from "lucide-react";

import {
  addPolicyNote,
  updatePolicyNode,
  updatePolicyNote,
  type GraphFeedbackLoop,
  type GraphNote,
  type PolicyGraphPayload,
} from "@/lib/policygraph/analyze.functions";
import { FeedbackLoopCard } from "../feedback-loop-card";
import { SystemMapCanvas } from "../system-map-canvas";
import { useWizard } from "./wizard-context";

type InspectorMode = "policy" | "node" | "loop";

export function Step3SystemMap() {
  const w = useWizard();
  const a = w.analysis;
  const graph = a?.graph;
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedLoopId, setSelectedLoopId] = useState<number | null>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const addNoteFn = useServerFn(addPolicyNote);
  const updateNoteFn = useServerFn(updatePolicyNote);
  const updateNodeFn = useServerFn(updatePolicyNode);

  const stakeholderNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const stakeholder of graph?.stakeholders ?? []) {
      const id = stakeholder.stakeholder_id;
      const name = stakeholder.stakeholder_name;
      if (typeof id === "number" && typeof name === "string") {
        map.set(id, name);
      }
    }
    return map;
  }, [graph?.stakeholders]);

  const addNote = useMutation({
    mutationFn: async (payload: {
      policyId: number;
      relatedObjectType: string;
      relatedObjectId?: number;
      noteText: string;
    }) => addNoteFn({ data: payload }),
    onSuccess: (note) => {
      applyGraphNote(note);
      setNoteDraft("");
    },
  });

  const saveNoteEdit = useMutation({
    mutationFn: async (payload: { policyId: number; noteId: number; noteText: string }) =>
      updateNoteFn({ data: payload }),
    onSuccess: (note) => {
      applyGraphNote(note);
      setEditingNoteId(null);
      setEditingNoteText("");
    },
  });

  const moveNode = useMutation({
    mutationFn: async (payload: { policyId: number; nodeId: number; x: number; y: number }) =>
      updateNodeFn({ data: payload }),
    onSuccess: (node) => {
      if (!w.analysis?.graph) return;
      const nextGraph: PolicyGraphPayload = {
        ...w.analysis.graph,
        nodes: w.analysis.graph.nodes.map((item) =>
          item.policy_node_id === node.policy_node_id ? node : item,
        ),
      };
      w.setAnalysis({ ...w.analysis, graph: nextGraph });
    },
  });

  function applyGraphNote(note: GraphNote) {
    if (!w.analysis?.graph) return;
    const hasNote = w.analysis.graph.notes.some((item) => item.note_id === note.note_id);
    const nextNotes = hasNote
      ? w.analysis.graph.notes.map((item) => (item.note_id === note.note_id ? note : item))
      : [...w.analysis.graph.notes, note];
    w.setAnalysis({
      ...w.analysis,
      graph: {
        ...w.analysis.graph,
        notes: nextNotes,
      },
    });
  }

  if (!a || !graph) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed hairline bg-surface/40 p-10 text-center">
        <p className="text-muted-foreground">No system map has been generated yet.</p>
      </div>
    );
  }

  const selectedNode =
    selectedNodeId !== null
      ? (graph.nodes.find((node) => node.policy_node_id === selectedNodeId) ?? null)
      : null;
  const selectedLoop =
    selectedLoopId !== null
      ? (graph.feedbackLoops.find((loop) => loop.feedback_loop_id === selectedLoopId) ?? null)
      : null;
  const relatedNotes = resolveRelatedNotes(graph, selectedNodeId, selectedLoopId, inspectorMode);
  const fallbackLoops = a.loops;

  function openPolicyNotes() {
    setSelectedNodeId(null);
    setSelectedLoopId(null);
    setInspectorMode("policy");
  }

  function openNode(nodeId: number | null) {
    setSelectedNodeId(nodeId);
    setSelectedLoopId(null);
    setInspectorMode(nodeId === null ? null : "node");
  }

  function openLoop(loopId: number) {
    setSelectedLoopId(loopId);
    setSelectedNodeId(null);
    setInspectorMode("loop");
  }

  function closeInspector() {
    setSelectedNodeId(null);
    setSelectedLoopId(null);
    setInspectorMode(null);
    setNoteDraft("");
    setEditingNoteId(null);
    setEditingNoteText("");
  }

  function submitNote() {
    if (!noteDraft.trim()) return;
    const relatedObjectType =
      inspectorMode === "loop" ? "feedback_loop" : inspectorMode === "node" ? "node" : "policy";
    const relatedObjectId =
      inspectorMode === "loop"
        ? selectedLoop?.feedback_loop_id
        : inspectorMode === "node"
          ? selectedNode?.policy_node_id
          : graph.policy.policy_id;

    addNote.mutate({
      policyId: graph.policy.policy_id,
      relatedObjectType,
      relatedObjectId,
      noteText: noteDraft.trim(),
    });
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Step 3 — Relationship map
          </div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            Visualise the relationships before deciding what to change
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
            The map should show which pressures, actors, and outcomes are influencing each other.
            Select a node or a loop to inspect the reasoning, add iteration notes, and refine the
            story until the policy logic is legible.
          </p>
          {graph.interventionPoints.length > 0 && (
            <div className="mt-4 flex max-w-4xl flex-wrap gap-2">
              {graph.interventionPoints.slice(0, 5).map((point) => (
                <span
                  key={point}
                  className="rounded-full border border-primary/18 bg-primary/6 px-3 py-1.5 text-[11px] font-medium text-primary"
                >
                  Intervention point: {point}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MetricPill label="Nodes" value={graph.nodes.length} />
          <MetricPill label="Connections" value={graph.edges.length} />
          <MetricPill label="Loops" value={graph.feedbackLoops.length} />
          <button
            type="button"
            onClick={openPolicyNotes}
            className="inline-flex items-center gap-2 rounded-full border hairline bg-white px-4 py-2 text-xs font-medium text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:border-primary/25 hover:text-primary"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Policy notes
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[32px] border hairline bg-white shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between border-b hairline px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
              Interactive graph
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Click a node to inspect it. Select a loop to isolate a cycle. Green arrows show
              reinforcing influence and red arrows show reducing influence.
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {graph.feedbackLoops.slice(0, 4).map((loop, index) => {
              const active = selectedLoopId === loop.feedback_loop_id;
              return (
                <button
                  key={loop.feedback_loop_id}
                  type="button"
                  onClick={() => openLoop(loop.feedback_loop_id)}
                  className={`rounded-full px-3 py-2 text-left text-xs transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(29,78,216,0.22)]"
                      : "border hairline bg-surface text-foreground hover:border-primary/25 hover:text-primary"
                  }`}
                >
                  <span className="font-mono uppercase tracking-[0.18em]">
                    {loop.loop_type === "reinforcing" ? `R${index + 1}` : `B${index + 1}`}
                  </span>
                  <span className="ml-2">{loop.loop_name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative p-4 sm:p-6">
          <SystemMapCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            feedbackLoops={graph.feedbackLoops}
            selectedNodeId={selectedNodeId}
            selectedLoopId={selectedLoopId}
            selectedLoopNodeIds={selectedLoop?.involved_node_ids ?? []}
            selectedLoopConnectionIds={selectedLoop?.involved_connection_ids ?? []}
            onSelectNode={openNode}
            onSelectLoop={openLoop}
            onMoveNode={(nodeId, x, y) =>
              moveNode.mutate({ policyId: graph.policy.policy_id, nodeId, x, y })
            }
          />

          <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
            {graph.feedbackLoops.map((loop, index) => {
              const active = selectedLoopId === loop.feedback_loop_id;
              return (
                <button
                  key={loop.feedback_loop_id}
                  type="button"
                  onClick={() => openLoop(loop.feedback_loop_id)}
                  className={`rounded-full px-3 py-2 text-left text-xs transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(29,78,216,0.22)]"
                      : "border hairline bg-surface text-foreground"
                  }`}
                >
                  <span className="font-mono uppercase tracking-[0.18em]">
                    {loop.loop_type === "reinforcing" ? `R${index + 1}` : `B${index + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {graph.feedbackLoops.length > 0 || fallbackLoops.length > 0 ? (
        <section className="space-y-5">
          <div className="max-w-3xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
              Feedback loops
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              What is feeding back into itself
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These loop views explain the cycles that keep reinforcing or balancing the policy
              environment. Use them to see where one change starts triggering another.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {graph.feedbackLoops.length > 0
              ? graph.feedbackLoops.map((loop, index) => (
                  <button
                    key={loop.feedback_loop_id}
                    type="button"
                    onClick={() => openLoop(loop.feedback_loop_id)}
                    className="w-full text-left"
                  >
                    <FeedbackLoopCard
                      loop={{
                        id: loop.loop_key ?? `loop-${loop.feedback_loop_id}`,
                        title: loop.loop_name,
                        type: loop.loop_type === "reinforcing" ? "R" : "B",
                        chain: loop.involved_node_ids.map((nodeId) => ({
                          node:
                            graph.nodes.find((node) => node.policy_node_id === nodeId)?.label ??
                            `Node ${nodeId}`,
                          effect:
                            graph.edges.find(
                              (edge) =>
                                edge.source_node_id === nodeId || edge.target_node_id === nodeId,
                            )?.relationship_type ?? "influences",
                        })),
                        summary: loop.explanation,
                      }}
                      index={index}
                    />
                  </button>
                ))
              : fallbackLoops.map((loop, index) => (
                  <div key={loop.id} className="w-full text-left">
                    <FeedbackLoopCard loop={loop} index={index} />
                  </div>
                ))}
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-between border-t hairline pt-6">
        <button
          onClick={() => w.setStep(2)}
          className="inline-flex items-center gap-2 rounded-xl border hairline px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => w.setStep(4)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Suggested policy bundle <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <InspectorDrawer
        open={inspectorMode !== null}
        mode={inspectorMode}
        selectedNode={selectedNode}
        selectedLoop={selectedLoop}
        stakeholderNames={stakeholderNames}
        relatedNotes={relatedNotes}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        editingNoteId={editingNoteId}
        setEditingNoteId={setEditingNoteId}
        editingNoteText={editingNoteText}
        setEditingNoteText={setEditingNoteText}
        onClose={closeInspector}
        onSubmitNote={submitNote}
        onSaveNote={(noteId, noteText) =>
          saveNoteEdit.mutate({
            policyId: graph.policy.policy_id,
            noteId,
            noteText,
          })
        }
        isSubmittingNote={addNote.isPending}
        isSavingNote={saveNoteEdit.isPending}
        policySummary={a.policy.summary}
      />
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border hairline bg-surface px-4 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="ml-2 text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function InspectorDrawer({
  open,
  mode,
  selectedNode,
  selectedLoop,
  stakeholderNames,
  relatedNotes,
  noteDraft,
  setNoteDraft,
  editingNoteId,
  setEditingNoteId,
  editingNoteText,
  setEditingNoteText,
  onClose,
  onSubmitNote,
  onSaveNote,
  isSubmittingNote,
  isSavingNote,
  policySummary,
}: {
  open: boolean;
  mode: InspectorMode | null;
  selectedNode: PolicyGraphPayload["nodes"][number] | null;
  selectedLoop: GraphFeedbackLoop | null;
  stakeholderNames: Map<number, string>;
  relatedNotes: GraphNote[];
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  editingNoteId: number | null;
  setEditingNoteId: (value: number | null) => void;
  editingNoteText: string;
  setEditingNoteText: (value: string) => void;
  onClose: () => void;
  onSubmitNote: () => void;
  onSaveNote: (noteId: number, noteText: string) => void;
  isSubmittingNote: boolean;
  isSavingNote: boolean;
  policySummary: string;
}) {
  return (
    <div
      className={`fixed inset-0 z-40 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-slate-950/18 backdrop-blur-[2px] transition ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 w-full max-w-[460px] border-l hairline bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[-28px_0_60px_rgba(15,23,42,0.12)] transition duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b hairline px-6 py-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                {mode === "loop"
                  ? "Loop inspector"
                  : mode === "node"
                    ? "Node inspector"
                    : "Policy notes"}
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {mode === "loop"
                  ? selectedLoop?.loop_name
                  : mode === "node"
                    ? selectedNode?.label
                    : "Working notes"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mode === "loop"
                  ? selectedLoop?.explanation
                  : mode === "node"
                    ? selectedNode?.description
                    : policySummary}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border hairline bg-white p-2 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {mode === "node" && selectedNode ? (
              <section className="space-y-3">
                <InspectorMeta label="Level" value={selectedNode.level} />
                <InspectorMeta label="Category" value={selectedNode.category} />
                <InspectorMeta
                  label="Related stakeholders"
                  value={
                    selectedNode.related_stakeholder_ids.length > 0
                      ? selectedNode.related_stakeholder_ids
                          .map((id) => stakeholderNames.get(id) ?? `Stakeholder ${id}`)
                          .join(", ")
                      : "None linked"
                  }
                />
                <InspectorMeta label="Updated" value={formatDate(selectedNode.updated_at)} />
              </section>
            ) : null}

            {mode === "loop" && selectedLoop ? (
              <section className="space-y-3">
                <InspectorMeta
                  label="Loop type"
                  value={
                    selectedLoop.loop_type === "reinforcing" ? "Reinforcing loop" : "Balancing loop"
                  }
                />
                <InspectorMeta
                  label="Intervention points"
                  value={
                    selectedLoop.possible_intervention_points.length > 0
                      ? selectedLoop.possible_intervention_points.join(", ")
                      : "No intervention points stored"
                  }
                />
                <InspectorMeta
                  label="Affected stakeholders"
                  value={
                    selectedLoop.affected_stakeholder_ids.length > 0
                      ? selectedLoop.affected_stakeholder_ids
                          .map((id) => stakeholderNames.get(id) ?? `Stakeholder ${id}`)
                          .join(", ")
                      : "No linked stakeholders"
                  }
                />
              </section>
            ) : null}

            <section className="rounded-3xl border hairline bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                {mode === "loop"
                  ? "Add note to loop"
                  : mode === "node"
                    ? "Add note to node"
                    : "Add note to policy"}
              </div>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={4}
                placeholder="Capture a system insight, missing context, or an iteration decision."
                className="mt-3 w-full rounded-2xl border hairline bg-surface px-4 py-3 text-sm leading-6 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={onSubmitNote}
                  disabled={isSubmittingNote || !noteDraft.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {isSubmittingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save note
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                Attached notes
              </div>
              {relatedNotes.length > 0 ? (
                relatedNotes.map((note) => (
                  <div
                    key={note.note_id}
                    className="rounded-3xl border hairline bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {note.related_object_type} · {formatDate(note.updated_at)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.note_id);
                          setEditingNoteText(note.note_text);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border hairline bg-white px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
                      >
                        <PencilLine className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                    {editingNoteId === note.note_id ? (
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={editingNoteText}
                          onChange={(event) => setEditingNoteText(event.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border hairline bg-surface px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteText("");
                            }}
                            className="rounded-xl border hairline px-3 py-2 text-xs text-muted-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => onSaveNote(note.note_id, editingNoteText.trim())}
                            disabled={isSavingNote || !editingNoteText.trim()}
                            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                          >
                            Save change
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {note.note_text}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed hairline bg-surface px-4 py-5 text-sm text-muted-foreground">
                  No notes are attached to this selection yet.
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}

function InspectorMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border hairline bg-white/80 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

function resolveRelatedNotes(
  graph: PolicyGraphPayload,
  selectedNodeId: number | null,
  selectedLoopId: number | null,
  mode: InspectorMode | null,
) {
  if (mode === "loop" && selectedLoopId !== null) {
    return graph.notes.filter(
      (note) =>
        note.related_object_type === "feedback_loop" && note.related_object_id === selectedLoopId,
    );
  }
  if (mode === "node" && selectedNodeId !== null) {
    return graph.notes.filter(
      (note) => note.related_object_type === "node" && note.related_object_id === selectedNodeId,
    );
  }
  return graph.notes.filter((note) => note.related_object_type === "policy");
}

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
