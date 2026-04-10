"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2 } from "lucide-react";
import { sessionsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const title =
        trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
      const res = await sessionsApi.create(title);
      const sessionId = res.data.id;

      // Store the pending message so the chat page can auto-send it
      sessionStorage.setItem(`pending_msg_${sessionId}`, trimmed);

      // Refresh sidebar session list
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });

      router.push(`/chat/${sessionId}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Auto-resize textarea
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="text-5xl select-none">🦀</div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Open Crab
          </h1>
          <p className="text-muted-foreground text-sm">
            Ask anything — I can read files, search your knowledge base, and
            generate reports.
          </p>
        </div>

        {/* Input box */}
        <div className="relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring transition-shadow">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message Open Crab… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isSubmitting}
            className={cn(
              "w-full resize-none bg-transparent px-4 py-4 pr-14 text-sm outline-none",
              "placeholder:text-muted-foreground",
              "disabled:opacity-50",
              "max-h-[200px] overflow-y-auto"
            )}
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            aria-label="Send message"
            className={cn(
              "absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition-all",
              message.trim() && !isSubmitting
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Supports file operations, RAG search, and PDF generation.
        </p>
      </div>
    </div>
  );
}
