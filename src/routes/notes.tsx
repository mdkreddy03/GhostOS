import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Ghost OS" },
      { name: "description", content: "A private notebook for ideas, lists and anything you don't want to lose." },
      { property: "og:title", content: "Notes — Ghost OS" },
      { property: "og:description", content: "Your private Ghost OS notebook." },
    ],
  }),
  component: () => (
    <Gate>
      <NotesPage />
    </Gate>
  ),
});

function NotesPage() {
  const { state, update } = useGhost();
  const [title, setTitle] = useState("");

  function add() {
    if (!title.trim()) return;
    update((s) => ({
      notes: [{ id: uid(), title: title.trim(), body: "", updatedAt: Date.now() }, ...s.notes],
    }));
    setTitle("");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Notes</h1>
      <Tile title="New note">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Tile>

      <div className="grid gap-5 md:grid-cols-2">
        {state.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {state.notes.map((n) => (
          <Tile
            key={n.id}
            title={n.title}
            action={
              <button
                aria-label="Delete note"
                onClick={() => update((s) => ({ notes: s.notes.filter((x) => x.id !== n.id) }))}
              >
                <Trash2 className="size-4 opacity-60" />
              </button>
            }
          >
            <Textarea
              rows={6}
              value={n.body}
              placeholder="Start writing…"
              onChange={(e) =>
                update((s) => ({
                  notes: s.notes.map((x) =>
                    x.id === n.id ? { ...x, body: e.target.value, updatedAt: Date.now() } : x,
                  ),
                }))
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Saved {new Date(n.updatedAt).toLocaleString()}
            </p>
          </Tile>
        ))}
      </div>
    </div>
  );
}
