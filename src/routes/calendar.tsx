import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid, todayISO, daysUntil, bucket } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar & Tasks — Ghost OS" },
      { name: "description", content: "Plan tasks by date and see what's due today, this week and later." },
      { property: "og:title", content: "Calendar & Tasks — Ghost OS" },
      { property: "og:description", content: "Plan tasks by date inside Ghost OS." },
    ],
  }),
  component: () => (
    <Gate>
      <CalendarPage />
    </Gate>
  ),
});

function CalendarPage() {
  const { state, update } = useGhost();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const sorted = [...state.todos].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  function add() {
    if (!title.trim()) return;
    update((s) => ({ todos: [...s.todos, { id: uid(), title: title.trim(), date, note, done: false }] }));
    setTitle("");
    setNote("");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Calendar & Tasks</h1>

      <Tile title="New task">
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_1fr_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Tile>

      <Tile title={`All tasks (${state.todos.length})`}>
        <div className="space-y-2">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          {sorted.map((t) => {
            const b = bucket(daysUntil(t.date));
            const tone =
              b === "high" ? "bg-high" : b === "medium" ? "bg-medium" : "bg-low";
            return (
              <div key={t.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${t.done ? "bg-secondary" : tone}`}>
                <Checkbox
                  checked={t.done}
                  onCheckedChange={(v) =>
                    update((s) => ({
                      todos: s.todos.map((x) => (x.id === t.id ? { ...x, done: Boolean(v) } : x)),
                    }))
                  }
                />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </p>
                  <p className="text-xs opacity-75">
                    {t.date} {t.note ? `· ${t.note}` : ""}
                  </p>
                </div>
                <button
                  aria-label="Delete task"
                  onClick={() => update((s) => ({ todos: s.todos.filter((x) => x.id !== t.id) }))}
                >
                  <Trash2 className="size-4 opacity-60" />
                </button>
              </div>
            );
          })}
        </div>
      </Tile>
    </div>
  );
}
