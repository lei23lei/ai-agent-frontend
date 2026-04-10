"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { settingsApi, SettingsRead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // ── Load settings ──
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data;
    },
  });

  // Populate form when data arrives
  useEffect(() => {
    if (data) {
      setSystemPrompt(data.system_prompt ?? "");
      setApiKey(data.openai_api_key ?? "");
    }
  }, [data]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<SettingsRead>) => settingsApi.update(payload),
    onSuccess: (res) => {
      queryClient.setQueryData<SettingsRead>(["settings"], res.data);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    },
  });

  function handleSave() {
    saveMutation.mutate({
      system_prompt: systemPrompt,
      openai_api_key: apiKey,
    });
  }

  const isDirty =
    systemPrompt !== (data?.system_prompt ?? "") ||
    apiKey !== (data?.openai_api_key ?? "");

  // ── Render ──
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the AI&apos;s behavior and API credentials.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── System Prompt ── */}
          <section className="space-y-3">
            <div>
              <label className="text-sm font-semibold" htmlFor="system-prompt">
                System Prompt
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Instructions given to the AI at the start of every conversation.
                Leave empty to use the default behavior.
              </p>
            </div>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={
                "You are Open Crab, a helpful AI assistant with access to file\n" +
                "system tools and a knowledge base. Be concise and accurate."
              }
              rows={8}
              className={cn(
                "w-full resize-y rounded-xl border border-input bg-background px-4 py-3",
                "text-sm leading-relaxed outline-none",
                "focus:ring-2 focus:ring-ring transition-shadow",
                "placeholder:text-muted-foreground/60",
                "min-h-[120px]"
              )}
            />
          </section>

          <Separator />

          {/* ── OpenAI API Key ── */}
          <section className="space-y-3">
            <div>
              <label className="text-sm font-semibold" htmlFor="api-key">
                OpenAI API Key
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Override the server&apos;s default key. Leave empty to use the
                server&apos;s environment variable.
              </p>
            </div>
            <div className="relative">
              <input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                spellCheck={false}
                autoComplete="off"
                className={cn(
                  "w-full rounded-xl border border-input bg-background px-4 py-3 pr-11",
                  "font-mono text-sm outline-none",
                  "focus:ring-2 focus:ring-ring transition-shadow",
                  "placeholder:font-sans placeholder:text-muted-foreground/60"
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {apiKey && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Custom key is set — this overrides the server default.
              </p>
            )}
          </section>

          <Separator />

          {/* ── Save ── */}
          <div className="flex items-center justify-between">
            {/* Status feedback */}
            <div className="text-sm">
              {saveStatus === "success" && (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Settings saved.
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Failed to save. Please try again.
                </span>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
