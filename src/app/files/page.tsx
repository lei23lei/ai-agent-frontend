"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Globe,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { filesApi, DocumentOut, FileUploadResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILES = 10;
const ACCEPTED_EXT = [".txt", ".md", ".json", ".csv", ".pdf"];
const ACCEPTED_ATTR = ACCEPTED_EXT.join(",");

// ─── Types ───────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "uploading" | "completed" | "skipped" | "error";

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  result?: FileUploadResult;
}

type UrlStatus = { type: "success" | "skipped" | "error"; message: string };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // URL upload state
  const [urlInput, setUrlInput] = useState("");
  const [isUploadingUrl, setIsUploadingUrl] = useState(false);
  const [urlStatus, setUrlStatus] = useState<UrlStatus | null>(null);

  // Delete / Clear All state
  const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Queries / Mutations ──
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const res = await filesApi.list();
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setDeleteTarget(null);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: () => filesApi.clearAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setShowClearConfirm(false);
    },
  });

  // ── File selection helpers ──
  function addFiles(raw: FileList | File[]) {
    const arr = Array.from(raw).filter((f) => {
      const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
      return ACCEPTED_EXT.includes(ext);
    });

    setUploadFiles((prev) => {
      const incoming = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pending" as FileStatus,
        progress: 0,
      }));
      return [...prev, ...incoming].slice(0, MAX_FILES);
    });
  }

  function removeUploadFile(id: string) {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Drag & Drop ──
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  // ── File upload ──
  async function handleUpload() {
    const pending = uploadFiles.filter((f) => f.status === "pending");
    if (!pending.length || isUploading) return;

    setIsUploading(true);
    setUploadFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" ? { ...f, status: "uploading", progress: 0 } : f
      )
    );

    try {
      const res = await filesApi.upload(
        pending.map((f) => f.file),
        (pct) =>
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.status === "uploading" ? { ...f, progress: pct } : f
            )
          )
      );

      const results = res.data.results;
      setUploadFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploading") return f;
          const r = results.find((r) => r.filename === f.file.name);
          if (!r) return { ...f, status: "error" as FileStatus, progress: 100 };
          const status: FileStatus =
            r.status === "completed"
              ? "completed"
              : r.status === "skipped"
              ? "skipped"
              : "error";
          return { ...f, status, progress: 100, result: r };
        })
      );

      queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch (err) {
      console.error(err);
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error" as FileStatus, progress: 100 }
            : f
        )
      );
    } finally {
      setIsUploading(false);
    }
  }

  // ── URL upload ──
  async function handleUploadUrl() {
    const url = urlInput.trim();
    if (!url || isUploadingUrl) return;
    setIsUploadingUrl(true);
    setUrlStatus(null);
    try {
      const res = await filesApi.uploadUrl(url);
      const s = res.data.status;
      setUrlStatus({
        type: s === "completed" ? "success" : s === "skipped" ? "skipped" : "error",
        message:
          s === "completed"
            ? "URL content added to knowledge base."
            : s === "skipped"
            ? "Already exists — skipped (duplicate)."
            : "Failed to process URL.",
      });
      if (s === "completed") {
        setUrlInput("");
        queryClient.invalidateQueries({ queryKey: ["files"] });
      }
    } catch {
      setUrlStatus({ type: "error", message: "Could not reach URL or crawl failed." });
    } finally {
      setIsUploadingUrl(false);
    }
  }

  // ── Render ──
  const pendingCount = uploadFiles.filter((f) => f.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uploaded documents give Open Crab context for your conversations.
          </p>
        </div>
        {documents.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={clearAllMutation.isPending}
          >
            {clearAllMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Clear All
          </Button>
        )}
      </div>

      {/* ── Upload Files ── */}
      <section className="space-y-4">
        <SectionLabel>Upload Files</SectionLabel>

        {/* Drop zone */}
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/30",
            isUploading && "pointer-events-none opacity-60"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Drag &amp; drop or{" "}
            <span className="text-primary underline underline-offset-2">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ACCEPTED_EXT.join(" ")} &middot; max {MAX_FILES} files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_ATTR}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                addFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* File list */}
        {uploadFiles.length > 0 && (
          <div className="space-y-2">
            {uploadFiles.map((uf) => (
              <FileUploadRow
                key={uf.id}
                uf={uf}
                onRemove={() => removeUploadFile(uf.id)}
                disabled={isUploading}
              />
            ))}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {uploadFiles.length}/{MAX_FILES} files
              </span>
              <div className="flex gap-2">
                {!isUploading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadFiles([])}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={isUploading || pendingCount === 0}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* ── Add URL ── */}
      <section className="space-y-3">
        <SectionLabel>Add URL</SectionLabel>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlStatus(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleUploadUrl()}
              placeholder="https://example.com/article"
              disabled={isUploadingUrl}
              className={cn(
                "w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm outline-none",
                "focus:ring-2 focus:ring-ring transition-shadow",
                "disabled:opacity-60"
              )}
            />
          </div>
          <Button
            size="sm"
            onClick={handleUploadUrl}
            disabled={!urlInput.trim() || isUploadingUrl}
          >
            {isUploadingUrl ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Add URL"
            )}
          </Button>
        </div>

        {urlStatus && (
          <UrlStatusBanner status={urlStatus} />
        )}
      </section>

      <Separator />

      {/* ── Document list ── */}
      <section className="space-y-4">
        <SectionLabel>
          Documents{documents.length > 0 ? ` (${documents.length})` : ""}
        </SectionLabel>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload files or add a URL above.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border divide-y">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDelete={() => setDeleteTarget(doc)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Delete Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteTarget?.filename}&rdquo; and all its vector embeddings
              will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear All Dialog ── */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear entire knowledge base?</DialogTitle>
            <DialogDescription>
              All {documents.length} document
              {documents.length !== 1 ? "s" : ""}, embeddings, and physical
              files will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
            >
              {clearAllMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Clear All"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

// ── FileUploadRow ──

const STATUS_CONFIG: Record<
  FileStatus,
  { label: string; className: string }
> = {
  pending:   { label: "Pending",   className: "text-muted-foreground" },
  uploading: { label: "Uploading", className: "text-primary" },
  completed: { label: "Done",      className: "text-green-600 dark:text-green-400" },
  skipped:   { label: "Duplicate", className: "text-yellow-600 dark:text-yellow-400" },
  error:     { label: "Error",     className: "text-destructive" },
};

function FileUploadRow({
  uf,
  onRemove,
  disabled,
}: {
  uf: UploadFile;
  onRemove: () => void;
  disabled: boolean;
}) {
  const cfg = STATUS_CONFIG[uf.status];
  const showBar = uf.status === "uploading";

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">{uf.file.name}</span>
          <span className={cn("shrink-0 text-xs font-medium", cfg.className)}>
            {cfg.label}
          </span>
        </div>

        {showBar && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${uf.progress}%` }}
            />
          </div>
        )}

        {uf.status === "skipped" && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Already in knowledge base
          </p>
        )}
        {uf.status === "completed" && uf.result?.chunks_count ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {uf.result.chunks_count} chunks indexed
          </p>
        ) : null}
      </div>

      {!disabled && (
        <button
          onClick={onRemove}
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── UrlStatusBanner ──

function UrlStatusBanner({ status }: { status: UrlStatus }) {
  const styles = {
    success: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    skipped: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
    error:   "bg-destructive/10 text-destructive",
  };
  const Icon = {
    success: CheckCircle2,
    skipped: RotateCcw,
    error:   AlertCircle,
  }[status.type];

  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", styles[status.type])}>
      <Icon className="h-4 w-4 shrink-0" />
      {status.message}
    </div>
  );
}

// ── DocumentRow ──

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: DocumentOut;
  onDelete: () => void;
}) {
  const isUrl = doc.source_type === "url";
  const date = new Date(doc.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="group flex items-center gap-3 bg-background px-4 py-3 transition-colors hover:bg-muted/30">
      {isUrl ? (
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{doc.filename}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs",
          isUrl
            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        {doc.source_type}
      </span>

      <button
        onClick={onDelete}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete document"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
