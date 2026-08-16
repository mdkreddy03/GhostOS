import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChefHat, Trash2 } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhostContext } from "@/components/ghost/ghost-ai";
import { ghostAi } from "@/lib/ai.functions";
import { useGhost, uid } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [
      { title: "Food & Recipes — Ghost OS" },
      { name: "description", content: "Ask Ghost what to cook using what you have, and save the recipes you love." },
      { property: "og:title", content: "Food & Recipes — Ghost OS" },
      { property: "og:description", content: "Recipe ideas built around your groceries and health." },
    ],
  }),
  component: () => (
    <Gate>
      <FoodPage />
    </Gate>
  ),
});

function FoodPage() {
  const { state, update } = useGhost();
  const ghostContext = useGhostContext();
  const call = useServerFn(ghostAi);
  const [craving, setCraving] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function cook() {
    setBusy(true);
    setResult("");
    try {
      const res = await call({
        data: {
          mode: "recipe" as const,
          context: ghostContext,
          messages: [
            {
              role: "user" as const,
              content: `Suggest a recipe. Craving: ${craving.slice(0, 200) || "anything good"}. Ingredients I likely have: ${
                state.grocery.map((g) => g.item).join(", ") || "basic pantry staples"
              }.`,
            },
          ],
        },
      });
      setResult(res.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Food & Recipes</h1>

      <Tile title="What should I eat?">
        <div className="flex gap-2">
          <Input
            value={craving}
            onChange={(e) => setCraving(e.target.value)}
            placeholder="Something spicy, high protein, quick…"
          />
          <Button onClick={cook} disabled={busy}>
            <ChefHat className="size-4" /> {busy ? "Cooking…" : "Ask Ghost"}
          </Button>
        </div>
        {result && (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm whitespace-pre-wrap">{result}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update((s) => ({
                  savedRecipes: [
                    { id: uid(), title: result.split("\n")[0]?.slice(0, 60) || "Recipe", body: result },
                    ...s.savedRecipes,
                  ],
                }))
              }
            >
              Save recipe
            </Button>
          </div>
        )}
      </Tile>

      <Tile title={`Saved recipes (${state.savedRecipes.length})`}>
        <div className="space-y-3">
          {state.savedRecipes.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
          {state.savedRecipes.map((r) => (
            <div key={r.id} className="rounded-2xl bg-secondary px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-sm font-semibold">{r.title}</p>
                <button
                  aria-label="Delete recipe"
                  onClick={() => update((s) => ({ savedRecipes: s.savedRecipes.filter((x) => x.id !== r.id) }))}
                >
                  <Trash2 className="size-4 opacity-60" />
                </button>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}
