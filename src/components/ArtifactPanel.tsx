"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
// react-pdf v7 / pdfjs-dist v3 CSS paths
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// pdfjs-dist v3 ships CommonJS-compatible worker (.js, not .mjs) -- no webpack conflicts
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// --- Types -------------------------------------------------------------------

export interface Artifact {
  filename: string;
  download_url: string; // e.g. "/api/files/result/report.pdf"
  tool: string;
  version: number;
  messageId: string;
}

interface ArtifactPanelProps {
  artifact: Artifact;
  allVersions: Artifact[];
  onClose: () => void;
  onSelectVersion: (artifact: Artifact) => void;
  /** When true, renders as a full-screen mobile overlay with a back button */
  isMobile?: boolean;
}

// --- ArtifactPanel -----------------------------------------------------------

export function ArtifactPanel({
  artifact,
  allVersions,
  onClose,
  onSelectVersion,
  isMobile = false,
}: ArtifactPanelProps) {
  const downloadUrl = `${API_URL}${artifact.download_url}`;

  // Container width for responsive PDF pages
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(448); // fallback: 480px panel - 32px padding

  // PDF state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Measure container with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (width: number) => setContainerWidth(width);
    update(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) update(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset PDF state when artifact changes
  useEffect(() => {
    setNumPages(null);
    setLoadError(false);
  }, [artifact.download_url]);

  // 16px padding on each side inside the scroll area
  const pageWidth = Math.max(containerWidth - 32, 100);

  return (
    <div className="flex flex-col h-full w-full bg-background">

      {/* Toolbar (48px) */}
      <div className="flex items-center h-12 px-3 gap-2 border-b bg-background shrink-0">

        {/* Mobile: back arrow on the left */}
        {isMobile && (
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        {/* Filename */}
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate min-w-0 text-sm font-medium">
          {artifact.filename}
        </span>

        {/* Right-side controls: version switcher > Download > Close */}
        <div className="flex items-center gap-0.5 shrink-0">

          {/* Version switcher -- only when multiple artifacts exist */}
          {allVersions.length > 1 && (
            <>
              <button
                onClick={() => {
                  const prev = allVersions.find(
                    (v) => v.version === artifact.version - 1
                  );
                  if (prev) onSelectVersion(prev);
                }}
                disabled={artifact.version === 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                aria-label="Previous version"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {allVersions.map((v) => (
                <button
                  key={v.version}
                  onClick={() => onSelectVersion(v)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium transition-colors",
                    v.version === artifact.version
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  v{v.version}
                </button>
              ))}

              <button
                onClick={() => {
                  const next = allVersions.find(
                    (v) => v.version === artifact.version + 1
                  );
                  if (next) onSelectVersion(next);
                }}
                disabled={artifact.version === allVersions.length}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                aria-label="Next version"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}

          {/* Download button */}
          <a
            href={downloadUrl}
            download={artifact.filename}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7 px-2 text-xs gap-1"
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>

          {/* Desktop close button */}
          {!isMobile && (
            <button
              onClick={onClose}
              className="ml-0.5 p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{ background: "#e8e8e8" }}
      >
        {loadError ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p>Unable to preview. Please download the file.</p>
            <a
              href={downloadUrl}
              download={artifact.filename}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </a>
          </div>
        ) : (
          <Document
            file={downloadUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setLoadError(true)}
            loading={<PdfSkeleton width={pageWidth} />}
          >
            {numPages && (
              <div className="flex flex-col items-center gap-2 py-4">
                {Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={i}
                    pageNumber={i + 1}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                    className="shadow-md"
                    loading={
                      <div
                        className="bg-white animate-pulse"
                        style={{
                          width: pageWidth,
                          height: Math.round(pageWidth * 1.414),
                        }}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}

// --- PdfSkeleton -------------------------------------------------------------

function PdfSkeleton({ width }: { width: number }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div
        className="bg-white shadow-md animate-pulse"
        style={{ width, height: Math.round(width * 1.414) }}
      />
    </div>
  );
}
