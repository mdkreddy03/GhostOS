import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid, todayISO, daysUntil } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Ghost OS" },
      { name: "description", content: "Time-based reminders that feed straight into your daily priorities." },
      { property: "og:title", content: "Reminders — Ghost OS" },
      { property: "og:description", content: "Never forget a time-sensitive thing again." },
    ],
  }),
  component: () => (
    <Gate>
      <RemindersPage />
    </Gate>
  ),
});

function RemindersPage() {
  const { state, update } = useGhost();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");

  function add() {
    if (!title.trim()) return;
    update((s) => ({ reminders: [...s.reminders, { id: uid(), title: title.trim(), date, time }] }));
    setTitle("");
  }

  const sorted = [...state.reminders].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Reminders</h1>
      <Tile title="New reminder">
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_8rem_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Take medication" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Tile>
      <Tile title={`Upcoming (${state.reminders.length})`}>
        <div className="space-y-2">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">No reminders set.</p>}
          {sorted.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2">
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.date} at {r.time}
                </p>
              </div>
              <button
                aria-label="Delete reminder"
                onClick={() => update((s) => ({ reminders: s.reminders.filter((x) => x.id !== r.id) }))}
              >
                <Trash2 className="size-4 opacity-60" />
              </button>
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}
