import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, X, Sparkles } from "lucide-react";

import { ghostAi } from "@/lib/ai.functions";
import { useGhost, buildPriorities, money, monthlyIncome } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function useGhostSystemPrompt() {
  const { state } = useGhost();
  const priorities = buildPriorities(state).slice(0, 12);
  return [
    "You are Ghost, a warm, sharp personal life assistant inside the user's Ghost OS.",
    "Be concise, practical and specific. Use the user's own data below.",
    `User: ${state.profile.fullName || state.account?.username || "friend"}, ${state.profile.occupation || "unknown job"}, ${state.profile.location || "unknown location"}.`,
    `Goals: ${state.profile.goals || "none stated"}. Vibe: ${state.profile.vibe || "n/a"}.`,
    `Monthly income: ${money(monthlyIncome(state.finance))}. Cash on hand: ${money(state.finance.cash)}.`,
    `Obligations: ${state.finance.obligations.map((o) => `${o.label} ${money(o.amount)} due ${o.dueDate}`).join("; ") || "none"}.`,
    `Health: ${state.health.weightKg || "?"}kg, ${state.health.heightCm || "?"}cm, age ${state.health.age || "?"}, activity ${state.health.activity}. Conditions: ${state.health.conditions || "none"}. Meds: ${state.health.medications || "none"}.`,
    `Upcoming: ${priorities.map((p) => `${p.title} (${p.date}, ${p.days}d)`).join("; ") || "nothing scheduled"}.`,
    `Notes titles: ${state.notes.map((n) => n.title).join(", ") || "none"}.`,
    `Grocery staples: ${state.grocery.map((g) => g.item).join(", ") || "none"}.`,
  ].join("\n");
}

export function GhostChat({ compact = false }: { compact?: boolean }) {
  const system = useGhostSystemPrompt();
  const { state } = useGhost();
  const call = useServerFn(ghostAi);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hey ${state.profile.fullName?.split(" ")[0] || state.account?.username || "there"} — ask me about your day, money, food, health or anything on your list.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await call({ data: { system, messages: next.slice(-12) } });
      setMessages([...next, { role: "assistant", content: res.text }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "I couldn't reach my brain just now. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["What should I do first today?", "How's my money looking?", "Give me a dinner idea"];

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex-1 space-y-3 overflow-y-auto pr-1", compact ? "max-h-72" : "min-h-0")}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && <div className="text-xs text-muted-foreground">Ghost is thinking…</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Talk to Ghost…" />
        <Button type="submit" size="icon" disabled={busy}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function GhostDock() {
  const [open, setOpen] = useState(false);
  const { state } = useGhost();

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-24 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col rounded-3xl border border-border bg-card p-4 shadow-tile">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-display text-sm font-semibold">Ghost AI</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close Ghost AI">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <GhostChat />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle Ghost AI"
        className="fixed right-4 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-tile transition-transform hover:scale-105"
      >
        {state.account?.avatar ? (
          <span className="text-2xl">{state.account.avatar}</span>
        ) : (
          <Bot className="size-6" />
        )}
      </button>
    </>
  );
}
