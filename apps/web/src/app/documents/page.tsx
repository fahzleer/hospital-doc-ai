"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ClassifyResponse,
  type DocumentRow,
  ENTITY_TYPES,
  type EntityType,
  type ListDocumentsResponse,
  classifyRequestSchema,
  createDocumentSchema,
} from "@app/types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type } from "arktype";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchDocuments(params: {
  entityType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListDocumentsResponse> {
  const url = new URL(`${API}/documents`);
  if (params.entityType) url.searchParams.set("entityType", params.entityType);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET /documents failed: ${res.status}`);
  return res.json() as Promise<ListDocumentsResponse>;
}

async function postDocument(payload: {
  entityType: EntityType;
  description?: string;
}): Promise<DocumentRow> {
  const res = await fetch(`${API}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? "POST failed");
  }
  return res.json() as Promise<DocumentRow>;
}

async function postClassify(text: string): Promise<ClassifyResponse> {
  const res = await fetch(`${API}/documents/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? "classify failed");
  }
  return res.json() as Promise<ClassifyResponse>;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const LABEL: Record<EntityType, string> = {
  work_order: "Work Order",
  contract: "Contract",
  issue_note: "Issue Note",
};

const BADGE_CLASS: Record<EntityType, string> = {
  work_order: "bg-blue-500/20 text-blue-300",
  contract: "bg-green-500/20 text-green-300",
  issue_note: "bg-orange-500/20 text-orange-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </td>
    </tr>
  );
}

const PAGE_SIZE = 10;
const SKELETON_COUNT = 5;

export default function DocumentRegistryPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<EntityType | "">("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reactive on filter/search changes to reset page
  useEffect(() => setPage(1), [debouncedSearch, filterType]);

  const [modal, setModal] = useState<"manual" | "ai" | null>(null);
  const [manualType, setManualType] = useState<EntityType>("work_order");
  const [manualText, setManualText] = useState("");
  const [manualError, setManualError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const [lastResult, setLastResult] = useState<{ code: string; entityType: string } | null>(null);

  const queryKey = ["documents", debouncedSearch, filterType, page] as const;

  const { data, isLoading, isError, error, isFetching, isPlaceholderData } = useQuery({
    queryKey,
    queryFn: () =>
      fetchDocuments({
        search: debouncedSearch || undefined,
        entityType: filterType || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const optimisticKeyRef = useRef(queryKey);
  optimisticKeyRef.current = queryKey;

  const manualMutation = useMutation({
    mutationFn: postDocument,

    onMutate: async (payload: { entityType: EntityType; description?: string }) => {
      await qc.cancelQueries({ queryKey: optimisticKeyRef.current });

      const previous = qc.getQueryData<ListDocumentsResponse>(optimisticKeyRef.current);

      if (previous) {
        const optimisticRow: DocumentRow = {
          id: `optimistic-${Date.now()}`,
          entityType: payload.entityType,
          code: "Issuing...",
          description: payload.description ?? null,
          createdAt: new Date().toISOString(),
        };
        qc.setQueryData<ListDocumentsResponse>(optimisticKeyRef.current, {
          ...previous,
          rows: [optimisticRow, ...previous.rows],
          total: previous.total + 1,
        });
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(optimisticKeyRef.current, context.previous);
      }
      setManualError(_err.message);
    },

    onSuccess: (doc) => {
      setLastResult({ code: doc.code, entityType: doc.entityType });
      setModal(null);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  function makeClassifyMutation(setError: (s: string) => void) {
    return {
      mutationFn: postClassify,
      onSuccess: (res: ClassifyResponse) => {
        if (res.code) {
          qc.invalidateQueries({ queryKey: ["documents"] });
          setLastResult({ code: res.code, entityType: res.entityType });
        }
        setModal(null);
      },
      onError: (err: Error) => setError(err.message),
    };
  }

  const aiMutation = useMutation(makeClassifyMutation(setAiError));

  function handleManualSubmit() {
    setManualError("");
    const validated = createDocumentSchema({
      entityType: manualType,
      ...(manualText.trim() ? { description: manualText.trim() } : {}),
    });
    if (validated instanceof type.errors) {
      setManualError(validated.summary);
      return;
    }
    manualMutation.mutate({
      entityType: validated.entityType,
      description: validated.description,
    });
  }

  function handleAiSubmit() {
    setAiError("");
    const validated = classifyRequestSchema({ text: aiText });
    if (validated instanceof type.errors) {
      setAiError(validated.summary);
      return;
    }
    aiMutation.mutate(validated.text);
  }

  function openModal(m: "manual" | "ai") {
    setManualError("");
    setManualText("");
    setAiError("");
    setModal(m);
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const showSkeleton = isLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Hospital ERP
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Document Registry
            {isFetching && !isLoading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">Updating...</span>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openModal("manual")}>
            + New Document
          </Button>
          <Button onClick={() => openModal("ai")}>✦ AI Auto-Issue</Button>
        </div>
      </div>

      {lastResult && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-green-700 bg-green-900/20 px-4 py-2 text-sm text-green-300">
          <span>
            Issued <strong>{lastResult.code}</strong> successfully (
            {LABEL[lastResult.entityType as EntityType] ?? lastResult.entityType})
          </span>
          <button
            type="button"
            onClick={() => setLastResult(null)}
            className="ml-4 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search by code, e.g. WO-2569"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-64"
        />
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as EntityType | "")}
          className="w-44"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      <div
        className={[
          "rounded-lg border border-border transition-opacity",
          isPlaceholderData ? "opacity-60" : "opacity-100",
        ].join(" ")}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Code</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Issued At</th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no meaningful identity
              Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            )}

            {!showSkeleton && !isError && data?.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No documents found
                </td>
              </tr>
            )}

            {!showSkeleton &&
              data?.rows.map((doc: DocumentRow) => (
                <tr
                  key={doc.id}
                  className={[
                    "border-b border-border last:border-0 hover:bg-accent/30",
                    doc.id.startsWith("optimistic-") ? "animate-pulse opacity-60" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-mono font-semibold">{doc.code}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        BADGE_CLASS[doc.entityType as EntityType] ??
                        "bg-muted text-muted-foreground"
                      }
                    >
                      {LABEL[doc.entityType as EntityType] ?? doc.entityType}
                    </Badge>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                    <span className="line-clamp-2">{doc.description ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} items · Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
          role="presentation"
          onClick={() => setModal(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setModal(null);
          }}
        >
          <dialog
            className="z-50 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            aria-modal="true"
            open
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {modal === "manual" && (
              <>
                <h2 className="mb-1 text-lg font-semibold">New Document</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Select a document type and issue manually — no AI
                </p>

                <label htmlFor="modal-desc" className="mb-1 block text-sm text-muted-foreground">
                  Description (optional)
                </label>
                <Textarea
                  id="modal-desc"
                  placeholder="e.g. Request 200 pairs of rubber gloves for operating room"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="mb-4 min-h-20 w-full"
                />

                <label htmlFor="modal-type" className="mb-1 block text-sm text-muted-foreground">
                  Document type
                </label>
                <Select
                  id="modal-type"
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as EntityType)}
                  className="mb-4 w-full"
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LABEL[t]}
                    </option>
                  ))}
                </Select>

                {manualError && <p className="mb-3 text-sm text-destructive">{manualError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <Button onClick={handleManualSubmit} disabled={manualMutation.isPending}>
                    {manualMutation.isPending ? "Issuing..." : "Issue"}
                  </Button>
                </div>
              </>
            )}

            {modal === "ai" && (
              <>
                <h2 className="mb-1 text-lg font-semibold">✦ AI Auto-Issue</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Describe the issue or request — AI will classify and issue a code automatically
                </p>
                <Textarea
                  placeholder="e.g. Air conditioner in operating room 3 is broken, urgent repair needed"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  className="mb-4 min-h-24 w-full"
                />
                {aiError && <p className="mb-3 text-sm text-destructive">{aiError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <Button onClick={handleAiSubmit} disabled={aiMutation.isPending}>
                    {aiMutation.isPending ? "AI analyzing..." : "Analyze & Issue"}
                  </Button>
                </div>
              </>
            )}
          </dialog>
        </div>
      )}
    </div>
  );
}
