"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FolderOpen,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";

import { sessionsApi, SessionOut } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Props ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar({ onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionOut | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await sessionsApi.list();
      return res.data.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      sessionsApi.rename(id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (pathname === `/chat/${deletedId}`) router.push("/");
    },
  });

  function startRename(session: SessionOut) {
    setRenamingId(session.id);
    setRenameValue(session.title);
    setTimeout(() => renameInputRef.current?.select(), 50);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== sessions.find((s) => s.id === id)?.title) {
      renameMutation.mutate({ id, title: trimmed });
    }
    setRenamingId(null);
  }

  const activeSessionId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // ── Collapsed view ──
  if (isCollapsed) {
    return (
      <div className="flex h-full flex-col items-center border-r border-sidebar-border bg-sidebar py-3 gap-1">
        {/* Expand button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
              />
            }
          >
            <PanelLeftOpen className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>

        {/* Logo */}
        <Link
          href="/"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-sidebar-accent/60 select-none"
          aria-label="Open Crab home"
        >
          🦀
        </Link>

        <Separator className="my-1 w-8 bg-sidebar-border" />

        {/* New Chat */}
        <NavIconLink
          href="/"
          icon={MessageSquarePlus}
          label="New Chat"
          onClick={onClose}
          isActive={false}
        />

        <div className="flex-1" />

        <Separator className="my-1 w-8 bg-sidebar-border" />

        {/* Files */}
        <NavIconLink
          href="/files"
          icon={FolderOpen}
          label="Files"
          onClick={onClose}
          isActive={pathname === "/files"}
        />

        {/* Settings */}
        <NavIconLink
          href="/settings"
          icon={Settings}
          label="Settings"
          onClick={onClose}
          isActive={pathname === "/settings"}
        />

        {/* Dark mode toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={toggleTheme}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
              />
            }
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {isDark ? "Light Mode" : "Dark Mode"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-4">
        <span className="text-2xl select-none">🦀</span>
        <span className="flex-1 font-semibold text-base tracking-tight truncate">
          Open Crab
        </span>
        {/* Collapse button — only visible on desktop */}
        <button
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground shrink-0"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-3">
        <Link
          href="/"
          onClick={onClose}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground"
          )}
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Session List */}
      <ScrollArea className="flex-1 px-2 py-2">
        {sessions.length === 0 ? (
          <p className="px-3 py-4 text-xs text-sidebar-foreground/50">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isRenaming = renamingId === session.id;

              return (
                <li key={session.id}>
                  <div
                    className={cn(
                      "group flex items-center rounded-md px-2 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                    )}
                  >
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(session.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(session.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <Link
                        href={`/chat/${session.id}`}
                        className="flex-1 min-w-0 truncate"
                        onClick={onClose}
                      >
                        {session.title}
                      </Link>
                    )}

                    {!isRenaming && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            "ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 dark:hover:bg-white/10",
                            isActive && "opacity-70 hover:opacity-100"
                          )}
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => startRename(session)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(session)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="px-2 py-3 space-y-0.5">
        <Link
          href="/files"
          onClick={onClose}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            pathname === "/files" && "bg-sidebar-accent/60"
          )}
        >
          <FolderOpen className="h-4 w-4" />
          Files
        </Link>
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            pathname === "/settings" && "bg-sidebar-accent/60"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          onClick={toggleTheme}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NavIconLink ─────────────────────────────────────────────────────────────

function NavIconLink({
  href,
  icon: Icon,
  label,
  onClick,
  isActive,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  isActive: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            onClick={onClick}
            aria-label={label}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent/60"
            )}
          />
        }
      >
        <Icon className="h-4 w-4" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
