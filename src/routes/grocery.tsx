import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["Produce", "Protein", "Dairy", "Pantry", "Frozen", "Household", "Other"];

export const Route = createFileRoute("/grocery")({
  head: () => ({
    meta: [
      { title: "Grocery — Ghost OS" },
      { name: "description", content: "Keep your staples and shopping list organised by aisle, with favourites pinned." },
      { property: "og:title", content: "Grocery — Ghost OS" },
      { property: "og:description", content: "Your recurring grocery list, sorted by category." },
    ],
  }),
  component: () => (
    <Gate>
      <GroceryPage />
    </Gate>
  ),
});

function GroceryPage() {
  const { state, update } = useGhost();
  const [item, setItem] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);

  function add() {
    if (!item.trim()) return;
    update((s) => ({ grocery: [...s.grocery, { id: uid(), item: item.trim(), category, favorite: false }] }));
    setItem("");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Grocery</h1>
      <Tile title="Add item">
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Greek yogurt" />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Tile>

      <div className="grid gap-5 md:grid-cols-2">
        {CATEGORIES.filter((c) => state.grocery.some((g) => g.category === c)).map((c) => (
          <Tile key={c} title={c}>
            <div className="space-y-2">
              {state.grocery
                .filter((g) => g.category === c)
                .map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2 text-sm">
                    <button
                      aria-label="Toggle favourite"
                      onClick={() =>
                        update((s) => ({
                          grocery: s.grocery.map((x) => (x.id === g.id ? { ...x, favorite: !x.favorite } : x)),
                        }))
                      }
                    >
                      <Star className={`size-4 ${g.favorite ? "fill-primary text-primary" : "opacity-50"}`} />
                    </button>
                    <span className="flex-1">{g.item}</span>
                    <button
                      aria-label="Delete item"
                      onClick={() => update((s) => ({ grocery: s.grocery.filter((x) => x.id !== g.id) }))}
                    >
                      <Trash2 className="size-4 opacity-60" />
                    </button>
                  </div>
                ))}
            </div>
          </Tile>
        ))}
        {state.grocery.length === 0 && <p className="text-sm text-muted-foreground">Your list is empty.</p>}
      </div>
    </div>
  );
}
