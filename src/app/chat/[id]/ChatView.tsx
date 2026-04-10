"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, FileText, Globe, Loader2 } from "lucide-react";
import { sessionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArtifactPanel, Artifact } from "@/components/ArtifactPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Source {
  filename?: string;
  page?: number;
  url?: string;
}

interface ConfirmationEvent {
  type: "confirmation_required";
  action: string;
  path: string;
  message: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  confirmation?: ConfirmationEvent;
  artifact?: Artifact;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ChatView({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [confirmation, setConfirmation] = useState<ConfirmationEvent | null>(null);

  // Artifact state
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [mobileArtifactOpen, setMobileArtifactOpen] = useState(false);
  const artifactCountRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load history ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoadingHistory(true);
      setMessages([]);
      setArtifacts([]);
      setCurrentArtifact(null);
      artifactCountRef.current = 0;

      try {
        const res = await sessionsApi.getMessages(sessionId);
        if (cancelled) return;

        const historyArtifacts: Artifact[] = [];
        const history: DisplayMessage[] = res.data.map((m) => {
          const msg: DisplayMessage = { id: m.id, role: m.role, content: m.content };
          if (m.artifact_path && m.artifact_filename && m.artifact_version != null) {
            const artifact: Artifact = {
              filename: m.artifact_filename,
              download_url: `/api/files/${m.artifact_path}`,
              tool: "pdf_report",
              version: m.artifact_version,
              messageId: m.id,
            };
            msg.artifact = artifact;
            historyArtifacts.push(artifact);
          }
          return msg;
        });
        setMessages(history);
        if (historyArtifacts.length > 0) {
          setArtifacts(historyArtifacts);
          artifactCountRef.current = historyArtifacts.length;
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }

      // Auto-send pending message (from home page navigation)
      const key = `pending_msg_${sessionId}`;
      const pending = sessionStorage.getItem(key);
      if (pending && !cancelled) {
        sessionStorage.removeItem(key);
        setTimeout(() => {
          if (!cancelled) sendMessage(pending);
        }, 100);
      }
    }

    init();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    resetTextareaHeight();
    setIsStreaming(true);

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch(`${API_URL}/api/chat/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: abort.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "token") {
            accumulatedContent += event.content as string;
            const snap = accumulatedContent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: snap } : m
              )
            );
          } else if (event.type === "artifact") {
            artifactCountRef.current += 1;
            const newArtifact: Artifact = {
              filename: event.filename as string,
              download_url: event.download_url as string,
              tool: event.tool as string,
              version: artifactCountRef.current,
              messageId: assistantMsgId,
            };
            setArtifacts((prev) => [...prev, newArtifact]);
            setCurrentArtifact(newArtifact);
            // Auto-open panel on desktop; open mobile overlay
            setMobileArtifactOpen(true);
            // Associate artifact with the assistant message
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, artifact: newArtifact } : m
              )
            );
          } else if (event.type === "metadata") {
            const sources = event.sources as Source[];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, sources, isStreaming: false }
                  : m
              )
            );
          } else if (event.type === "confirmation_required") {
            const confirmEvent = event as unknown as ConfirmationEvent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: confirmEvent.message,
                      isStreaming: false,
                      confirmation: confirmEvent,
                    }
                  : m
              )
            );
            setConfirmation(confirmEvent);
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      console.error("Stream error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Sorry, something went wrong. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, isStreaming: false } : m
        )
      );
      setIsStreaming(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  }

  // ── Confirmation handlers ──
  function handleConfirm(answer: "yes" | "no") {
    setConfirmation(null);
    const msg = answer === "yes" ? "Yes, please proceed." : "No, please cancel.";
    sendMessage(msg);
  }

  // ── Input handlers ──
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function resetTextareaHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // ── Render ──
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
            {isLoadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <span className="text-4xl">🦀</span>
                <p>Start the conversation</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onViewArtifact={(a) => {
                    setCurrentArtifact(a);
                    setMobileArtifactOpen(true);
                  }}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t bg-background px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? "Waiting for response…"
                    : "Message Open Crab… (Enter to send, Shift+Enter for new line)"
                }
                rows={1}
                disabled={isStreaming}
                className={cn(
                  "w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm outline-none",
                  "placeholder:text-muted-foreground",
                  "disabled:opacity-60",
                  "max-h-[200px] overflow-y-auto"
                )}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className={cn(
                  "absolute bottom-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  input.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* Desktop artifact panel */}
      {currentArtifact && (
        <div className="hidden lg:flex w-[480px] border-l shrink-0">
          <ArtifactPanel
            artifact={currentArtifact}
            allVersions={artifacts}
            onClose={() => setCurrentArtifact(null)}
            onSelectVersion={setCurrentArtifact}
          />
        </div>
      )}

      {/* Mobile artifact overlay */}
      {mobileArtifactOpen && currentArtifact && (
        <div className="fixed inset-0 z-50 bg-background lg:hidden">
          <ArtifactPanel
            artifact={currentArtifact}
            allVersions={artifacts}
            onClose={() => setMobileArtifactOpen(false)}
            onSelectVersion={setCurrentArtifact}
            isMobile
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmation} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              {confirmation?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleConfirm("no")}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleConfirm("yes")}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onViewArtifact,
}: {
  message: DisplayMessage;
  onViewArtifact: (a: Artifact) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* Avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs select-none">
          🦀
        </div>
      )}

      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start", "max-w-[80%]")}>
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {message.content ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : message.isStreaming ? (
            <TypingIndicator />
          ) : null}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
          )}
        </div>

        {/* View Report button */}
        {message.artifact && (
          <button
            onClick={() => onViewArtifact(message.artifact!)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            View Report
          </button>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <SourceBadge key={i} source={src} />
            ))}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium select-none">
          U
        </div>
      )}
    </div>
  );
}

// ─── TypingIndicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

// ─── SourceBadge ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: Source }) {
  const isUrl = !!source.url;
  const label = isUrl
    ? new URL(source.url!).hostname
    : source.page
    ? `${source.filename} · p.${source.page}`
    : source.filename ?? "Source";

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors",
        isUrl
          ? "cursor-pointer hover:bg-muted hover:text-foreground"
          : "cursor-default"
      )}
    >
      {isUrl ? (
        <Globe className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      {label}
    </span>
  );

  if (isUrl) {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}
